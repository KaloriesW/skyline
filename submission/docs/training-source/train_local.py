"""Fine-tune a 13-input copy only after explicit geographic label/data gates pass.

The comparator is a transferred copy of our current best, not a claim that the
original 14-input checkpoint works unchanged on live L2A data.
"""
from pathlib import Path
import argparse,copy,csv,json,os,random,sys,time
import numpy as np
from core import HERE,ROOT,CONTRACT,training_gate,sha,write,check_plan
sys.path.insert(0,str(ROOT/'work/pretrained-unet-deps'))
sys.path.insert(0,str(ROOT/'outputs/landslide-training/semantic14'))
import torch,rasterio
from torch.utils.data import Dataset,DataLoader,WeightedRandomSampler
import segmentation_models_pytorch as smp
from metrics import calibrate,metrics,counts

CHECKPOINT=ROOT/'outputs/landslide-training/unet14-resnet34-pretrained/01_resnet34_pretrained/best.pt'
EXPECTED_SHA='1571d5440d62be2e0d67902ad0f1151cdda60a96415d5c60cd295528cc962189'
KEEP=[i for i in range(14) if i!=9]  # Drop B10, retain every other trained channel in order.

class LocalModel(torch.nn.Module):
 def __init__(self):
  super().__init__();self.network=smp.Unet(encoder_name='resnet34',encoder_weights=None,in_channels=13,
       classes=1,activation=None,decoder_channels=(256,128,64,32,16))
 def forward(self,x):return self.network(x)

def transferred_model():
 if sha(CHECKPOINT)!=EXPECTED_SHA:raise ValueError('Current best checkpoint changed; re-audit the transfer')
 saved=torch.load(CHECKPOINT,map_location='cpu',weights_only=False)
 state=saved['model'];key='network.encoder.conv1.weight'
 state[key]=state[key][:,KEEP].clone()
 model=LocalModel();model.load_state_dict(state,strict=True);return model

class ReviewedDataset(Dataset):
 def __init__(self,doc,split,augment=False):
  self.rows=[r for r in doc['samples'] if r['split']==split];self.augment=augment
  self.mean=np.array(doc['train_mean'],np.float32)[:,None,None]
  self.std=np.array(doc['train_std'],np.float32)[:,None,None]
 def __len__(self):return len(self.rows)
 def __getitem__(self,i):
  from PIL import Image
  row=self.rows[i]
  with rasterio.open(row['image_path']) as src:x=src.read()
  label=np.array(Image.open(row['mask_path']));valid=label!=255;y=(label==1).astype('float32')
  x=(x-self.mean)/self.std;x=np.nan_to_num(x,nan=0,posinf=0,neginf=0)
  if self.augment:
   k=np.random.randint(4);x=np.rot90(x,k,axes=(-2,-1));y=np.rot90(y,k);valid=np.rot90(valid,k)
   if np.random.random()<.5:x=x[...,::-1];y=y[:,::-1];valid=valid[:,::-1]
  return torch.from_numpy(x.copy()),torch.from_numpy(y.copy()),torch.from_numpy(valid.copy()),row['id']

def loss_fn(logits,y,valid):
 z=logits[:,0][valid];target=y[valid]
 if not z.numel():raise ValueError('Batch has no reviewed pixels')
 bce=torch.nn.functional.binary_cross_entropy_with_logits(z,target,pos_weight=z.new_tensor(3.))
 prob=z.sigmoid();dice=1-(2*(prob*target).sum()+1)/(prob.sum()+target.sum()+1)
 return .5*bce+.5*dice

def sampler_weights(rows):
 positive=sum(r['positive_pixels']>0 for r in rows);negative=len(rows)-positive
 return [float((2 if r['positive_pixels']==0 and set(r['tags'])&{'riverbed','road','quarry'} else 1)/
          max(positive if r['positive_pixels']>0 else negative,1)) for r in rows]

def predict(model,dataset,device):
 model.eval();probs=[];truth=[];valid=[];names=[]
 with torch.inference_mode():
  for x,y,v,n in DataLoader(dataset,batch_size=8,shuffle=False):
   probs.append(model(x.to(device))[:,0].sigmoid().cpu().numpy());truth.append(y.numpy().astype(bool));valid.append(v.numpy());names+=list(n)
 return np.concatenate(probs),np.concatenate(truth),np.concatenate(valid),names

def summarize(arrays,threshold):
 p,t,v,names=arrays;pred=p>np.float32(threshold)
 report=metrics(*counts(pred[v],t[v]));report['threshold']=threshold;report['images']=len(names)
 report['reviewed_pixels']=int(v.sum());report['ignored_pixels']=int((~v).sum())
 report['per_image']=[{'id':n,**metrics(*counts(pi[vi],ti[vi])),'reviewed_pixels':int(vi.sum())}
    for pi,ti,vi,n in zip(pred,t,v,names)]
 report['mean_patch_iou']=float(np.mean([r['pixel_iou'] for r in report['per_image']]))
 return report

def threshold_for(arrays):
 p,t,v,_=arrays;return calibrate(p[v],t[v])[0]['confidence']

def verify(doc):
 training_gate(doc)
 if doc['plan_sha256']!=sha(HERE/'plan.json'):raise ValueError('Geographic split plan changed after export')
 check_plan(json.loads((HERE/'plan.json').read_text()))
 mean=np.asarray(doc['train_mean']);std=np.asarray(doc['train_std'])
 if mean.shape!=(13,) or std.shape!=(13,) or not np.isfinite(mean).all() or not np.isfinite(std).all() or (std<=0).any():raise ValueError('Invalid training normalization')
 for row in doc['samples']:
  if sha(row['image_path'])!=row['image_sha256'] or sha(row['mask_path'])!=row['mask_sha256']:
   raise ValueError('Frozen image/label changed: '+row['id'])
  with rasterio.open(row['image_path']) as src:
   if list(src.descriptions)!=CONTRACT['bands'] or src.shape!=(128,128) or src.count!=13:
    raise ValueError('Input band order/shape mismatch')

def run(dataset_path,epochs=30,device='mps'):
 if not 12<=epochs<=100:raise ValueError('Epoch count must be between 12 and 100')
 doc=json.loads(dataset_path.read_text());verify(doc)
 if device=='mps' and not torch.backends.mps.is_available():raise RuntimeError('MPS is required; no automatic CPU fallback')
 torch.set_num_threads(2);torch.manual_seed(0);np.random.seed(0);random.seed(0)
 output=HERE/'runs'/time.strftime('%Y%m%d-%H%M%S');output.mkdir(parents=True,exist_ok=False)
 write(output/'dataset.json',doc)
 config={'epochs':epochs,'lr':.0001,'batch':8,'seed':0,'patience':8,'minimum_epochs':12,
  'input_contract':CONTRACT,'initial_checkpoint_sha256':EXPECTED_SHA,
  'comparison':'Frozen 13-channel transferred current-best vs local fine-tuning, both using local train-only normalization.',
  'sampling':'Training only: class-balanced patch sampling; 2x weight for reviewed negative road/riverbed/quarry patches.',
  'reference_type':doc['reference_type'],'app_integration':False}
 write(output/'config.json',config)
 def status(**kw):write(HERE/'training_status.json',{'run_directory':str(output),'pid':os.getpid(),**kw})
 baseline=transferred_model().to(device);val=ReviewedDataset(doc,'val')
 baseline_val=predict(baseline,val,device);baseline_threshold=threshold_for(baseline_val)
 write(output/'baseline-validation.json',summarize(baseline_val,baseline_threshold))
 # Freeze the reference and keep a separate trainable copy.
 model=copy.deepcopy(baseline).to(device);baseline=baseline.to('cpu')
 train=ReviewedDataset(doc,'train',True)
 sampler=WeightedRandomSampler(sampler_weights(train.rows),len(train),replacement=True,
                               generator=torch.Generator().manual_seed(0))
 loader=DataLoader(train,batch_size=8,sampler=sampler,num_workers=0)
 optimizer=torch.optim.AdamW(model.parameters(),lr=.0001,weight_decay=.0001)
 best=-1;bad=0;history=[]
 for epoch in range(epochs):
  model.train();total=0;seen=0
  for x,y,v,_ in loader:
   x=x.to(device);y=y.to(device);v=v.to(device);optimizer.zero_grad(set_to_none=True)
   loss=loss_fn(model(x),y,v)
   if not torch.isfinite(loss):raise RuntimeError('Nonfinite training loss')
   loss.backward();torch.nn.utils.clip_grad_norm_(model.parameters(),5,error_if_nonfinite=True);optimizer.step()
   total+=float(loss.detach().item())*len(x);seen+=len(x)
  arrays=predict(model,val,device);threshold=threshold_for(arrays);score=summarize(arrays,threshold)
  row={'epoch':epoch+1,'loss':total/seen,**{k:score[k] for k in ['pixel_iou','pixel_dice','pixel_precision','pixel_recall','threshold']}}
  history.append(row);write(output/'history.json',history)
  if score['pixel_iou']>best+1e-6:
   best=score['pixel_iou'];bad=0
   tmp=output/'best.tmp';torch.save({'model':{k:v.detach().cpu() for k,v in model.state_dict().items()},
     'epoch':epoch+1,'threshold':threshold,'config':config,'dataset_sha256':sha(output/'dataset.json')},tmp);tmp.replace(output/'best.pt')
  else:bad+=1
  status(state='training',epoch=epoch+1,epochs=epochs,metrics=row,best_validation_iou=best)
  if epoch+1>=12 and bad>=8:break
 saved=torch.load(output/'best.pt',map_location='cpu',weights_only=False)
 model.load_state_dict(saved['model']);threshold=saved['threshold']
 # Test images are first read after both checkpoints and thresholds are fixed.
 test=ReviewedDataset(doc,'test');status(state='evaluating',message='Frozen comparison on geographic holdout')
 candidate_arrays=predict(model,test,device);candidate=summarize(candidate_arrays,threshold)
 del model
 if device=='mps':torch.mps.empty_cache()
 baseline=baseline.to(device)
 reference_arrays=predict(baseline,test,device);reference=summarize(reference_arrays,baseline_threshold)
 keys=['pixel_iou','pixel_dice','pixel_precision','pixel_recall','mean_patch_iou']
 result={'baseline_transferred_13':reference,'fine_tuned_13':candidate,
  'difference':{k:candidate[k]-reference[k] for k in keys},'best_epoch':saved['epoch'],
  'holdout_regions':sorted({r['region'] for r in doc['samples'] if r['split']=='test'}),
  'limits':['Small human-interpreted geographic holdout; not field confirmation.',
           'Does not measure the unchanged 14-band model on live inputs; both systems are adapted to 13 channels.',
           'No application integration performed.']}
 write(output/'comparison.json',result)
 with (output/'comparison.csv').open('w',newline='') as f:
  w=csv.writer(f);w.writerow(['metric','transferred_baseline','fine_tuned','difference'])
  for k in keys:w.writerow([k,reference[k],candidate[k],candidate[k]-reference[k]])
 import matplotlib;matplotlib.use('Agg')
 import matplotlib.pyplot as plt
 fig,ax=plt.subplots(figsize=(9,5),layout='constrained');x=np.arange(len(keys))
 ax.bar(x-.18,[reference[k]*100 for k in keys],.36,label='Transferred baseline')
 ax.bar(x+.18,[candidate[k]*100 for k in keys],.36,label='Local fine-tuning');ax.set_xticks(x,keys,rotation=15);ax.legend();ax.set_ylim(0,100)
 fig.savefig(output/'comparison.png',dpi=150);plt.close(fig)
 if sha(CHECKPOINT)!=EXPECTED_SHA:raise RuntimeError('Original checkpoint changed')
 status(state='completed',comparison=str(output/'comparison.json'),app_integration=False)
 return output

if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--dataset',type=Path,required=True);parser.add_argument('--epochs',type=int,default=30);args=parser.parse_args()
 try:print(run(args.dataset,args.epochs))
 except Exception as e:write(HERE/'training_status.json',{'state':'blocked' if isinstance(e,ValueError) else 'failed','reason':str(e),'app_integration':False});raise
