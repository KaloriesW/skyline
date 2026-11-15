"""Fine-tune a separate 13-input U-Net on official inventory reference masks."""
from pathlib import Path
import copy, json, os, random, sys, time
import numpy as np
from prepare_inventory import HERE, ROOT, BANDS, REFERENCE, sha, write, status, freeze
sys.path.insert(0,str(ROOT/'outputs/taiwan-unet-validation'))
from train_local import LocalModel, ReviewedDataset, loss_fn, predict, summarize, threshold_for
import torch
from torch.utils.data import DataLoader

SOURCE=ROOT/'outputs/landslide-training/unet14-hard-examples/01_hard_examples/best.pt'
SOURCE_SHA='48c8fdfad9aef7b01fe286e8811346a482a10bcd3cbe0ba81a2f5c4b722495f0'
KEEP=[i for i in range(14) if i!=9]

def transferred():
 if sha(SOURCE)!=SOURCE_SHA:raise ValueError('Reference checkpoint changed')
 state=torch.load(SOURCE,map_location='cpu',weights_only=False)['model']
 state['network.encoder.conv1.weight']=state['network.encoder.conv1.weight'][:,KEEP].clone()
 model=LocalModel();model.load_state_dict(state,strict=True);return model

def train(dataset_path,epochs=30):
 if not torch.backends.mps.is_available():raise RuntimeError('MPS unavailable; no automatic CPU fallback')
 doc=json.loads(Path(dataset_path).read_text());plan=json.loads((HERE/'plan.json').read_text())
 if doc['plan_sha256']!=sha(HERE/'plan.json'):raise ValueError('Plan changed')
 # Recheck hashes, geometry separation, normalization and data gates immediately before training.
 checked=freeze(plan,doc['samples'],save=False)
 if checked!=doc:raise ValueError('Dataset metadata or statistics changed')
 if not 12<=epochs<=100:raise ValueError('Invalid epoch count')
 torch.set_num_threads(2);torch.manual_seed(2023);np.random.seed(2023);random.seed(2023)
 output=HERE/'runs'/time.strftime('%Y%m%d-%H%M%S');output.mkdir(parents=True,exist_ok=False)
 write(output/'dataset.json',doc)
 config={'epochs':epochs,'batch':8,'lr':.0001,'weight_decay':.0001,'positive_weight':3,'patience':8,'minimum_epochs':12,
  'seed':2023,'initial_checkpoint':str(SOURCE),'initial_checkpoint_sha256':SOURCE_SHA,
  'reference_type':REFERENCE,'band_order':BANDS,'input_size':128,
  'comparison':'Frozen 13-channel transfer of best 14-channel U-Net versus local fine-tuning; both use identical local train-only normalization.',
  'limits':doc['limits'],'app_integration':False}
 write(output/'config.json',config)
 def update(**kw):status(run_directory=str(output),pid=os.getpid(),**kw)
 update(state='calibrating_reference',counts=doc['counts'])
 model=transferred().to('mps');val=ReviewedDataset(doc,'val')
 reference_arrays=predict(model,val,'mps');reference_threshold=threshold_for(reference_arrays)
 write(output/'reference-validation.json',summarize(reference_arrays,reference_threshold))
 reference={k:v.detach().cpu().clone() for k,v in model.state_dict().items()}
 del reference_arrays
 trainset=ReviewedDataset(doc,'train',True)
 loader=DataLoader(trainset,batch_size=8,shuffle=True,num_workers=0)
 opt=torch.optim.AdamW(model.parameters(),lr=.0001,weight_decay=.0001)
 scheduler=torch.optim.lr_scheduler.CosineAnnealingLR(opt,T_max=epochs,eta_min=.00001)
 best=-1.;bad=0;history=[];started=time.monotonic()
 for epoch in range(epochs):
  model.train();total=0;seen=0
  for x,y,v,_ in loader:
   x=x.to('mps');y=y.to('mps');v=v.to('mps');opt.zero_grad(set_to_none=True)
   loss=loss_fn(model(x),y,v)
   if not torch.isfinite(loss):raise RuntimeError('Nonfinite loss')
   loss.backward();torch.nn.utils.clip_grad_norm_(model.parameters(),5,error_if_nonfinite=True);opt.step()
   total+=loss.detach().item()*len(x);seen+=len(x)
  arrays=predict(model,val,'mps');threshold=threshold_for(arrays);score=summarize(arrays,threshold)
  row={'epoch':epoch+1,'loss':total/seen,'lr':opt.param_groups[0]['lr'],**{k:score[k] for k in ['pixel_iou','pixel_dice','pixel_precision','pixel_recall','threshold']}}
  history.append(row);write(output/'history.json',history)
  if score['pixel_iou']>best+1e-6:
   best=score['pixel_iou'];bad=0
   tmp=output/'best.tmp';torch.save({'model':{k:v.detach().cpu() for k,v in model.state_dict().items()},
    'epoch':epoch+1,'threshold':threshold,'config':config,'dataset_sha256':sha(output/'dataset.json')},tmp);tmp.replace(output/'best.pt')
   write(output/'best-validation.json',score)
  else:bad+=1
  scheduler.step()
  update(state='training',epoch=epoch+1,epochs=epochs,metrics=row,best_validation_iou=best,
   estimated_remaining_seconds=(time.monotonic()-started)/(epoch+1)*(epochs-epoch-1))
  print(f'Epoch {epoch+1}: val IoU {score["pixel_iou"]:.4f}, threshold {threshold:.3f}',flush=True)
  if epoch+1>=12 and bad>=8:break
 saved=torch.load(output/'best.pt',map_location='cpu',weights_only=False);model.load_state_dict(saved['model'])
 # No test predictions or threshold tuning until model selection has finished.
 update(state='evaluating',best_epoch=saved['epoch'])
 test=ReviewedDataset(doc,'test');candidate_arrays=predict(model,test,'mps')
 candidate=summarize(candidate_arrays,saved['threshold'])
 model.load_state_dict(reference);reference_arrays=predict(model,test,'mps')
 baseline=summarize(reference_arrays,reference_threshold)
 result={'reference_transferred_13':baseline,'taiwan_fine_tuned_13':candidate,
  'best_epoch':saved['epoch'],'test_regions':sorted({r['region'] for r in doc['samples'] if r['split']=='test'}),
  'checkpoint_sha256':sha(output/'best.pt'),'limits':doc['limits']+[
   'This compares both models on the new inventory holdout; not directly comparable to Landslide4Sense IoU.',
   'No human audit of every mask and no claim of nationwide or field-verified accuracy.'],
  'app_integration':False}
 keys=['pixel_iou','pixel_dice','pixel_precision','pixel_recall']
 result['difference']={k:candidate[k]-baseline[k] for k in keys};write(output/'comparison.json',result)
 import matplotlib;matplotlib.use('Agg')
 import matplotlib.pyplot as plt
 fig,ax=plt.subplots(figsize=(9,5),layout='constrained');x=np.arange(len(keys))
 ax.bar(x-.18,[baseline[k]*100 for k in keys],.36,label='Frozen 13-channel transfer')
 ax.bar(x+.18,[candidate[k]*100 for k in keys],.36,label='Taiwan fine-tuned');ax.set_xticks(x,['IoU','Dice','Precision','Recall']);ax.legend();ax.set_ylim(0,100)
 ax.set_title('Separate Taiwan inventory holdout');fig.savefig(output/'comparison.png',dpi=140);plt.close(fig)
 # Fixed first six test samples, not selected for favorable predictions.
 from PIL import Image
 count=min(6,len(test));fig,axes=plt.subplots(count,4,figsize=(12,3*count),squeeze=False,layout='constrained')
 for i in range(count):
  row=test.rows[i];rgb=np.array(Image.open(Path(row['image_path']).parent/'rgb.png'))
  valid=candidate_arrays[2][i]
  displays=[rgb,np.ma.masked_where(~valid,candidate_arrays[1][i]),
   np.ma.masked_where(~valid,reference_arrays[0][i]>reference_threshold),
   np.ma.masked_where(~valid,candidate_arrays[0][i]>saved['threshold'])]
  for j,a in enumerate(displays):axes[i,j].imshow(a,cmap='Oranges',vmin=0,vmax=1) if j else axes[i,j].imshow(a);axes[i,j].axis('off')
  axes[i,0].set_title(row['id'])
 for j,title in enumerate(['RGB','Official inventory','Frozen transfer','Fine-tuned']):axes[0,j].set_title(title)
 fig.savefig(output/'predictions.png',dpi=110);plt.close(fig)
 if sha(SOURCE)!=SOURCE_SHA:raise RuntimeError('Reference checkpoint modified')
 update(state='completed',comparison=str(output/'comparison.json'),metrics={k:candidate[k] for k in keys})
 return output

if __name__=='__main__':train(HERE/'dataset.json')
