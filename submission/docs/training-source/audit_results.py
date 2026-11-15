"""Audit the frozen pilot; no retraining, test tuning, or app integration."""
import csv,json
from pathlib import Path
import numpy as np
import torch
from PIL import Image
from prepare_inventory import HERE,sha,write
from train_inventory import LocalModel,ReviewedDataset,predict,summarize
from metrics import metrics,calibrate

def aggregate(rows):
 return metrics(*(sum(r[k] for r in rows) for k in ['tp','fp','fn','tn']))

def main():
 state=json.loads((HERE/'status.json').read_text());run=Path(state['run_directory'])
 if state['state']!='completed':raise ValueError('Training is not complete')
 report=json.loads((run/'comparison.json').read_text());doc=json.loads((run/'dataset.json').read_text())
 if sha(run/'best.pt')!=report['checkpoint_sha256']:raise ValueError('Checkpoint changed')
 out=run/'audit';out.mkdir(exist_ok=True)
 plan=json.loads((HERE/'plan.json').read_text());region_info={r['id']:r for r in plan['regions']}
 samples={r['id']:r for r in doc['samples']}
 reference=report['reference_transferred_13'];candidate=report['taiwan_fine_tuned_13'];rows=[]
 for region in report['test_regions']:
  ref_rows=[r for r in reference['per_image'] if samples[r['id']]['region']==region]
  new_rows=[r for r in candidate['per_image'] if samples[r['id']]['region']==region]
  before=aggregate(ref_rows);after=aggregate(new_rows)
  rows.append({'region':region,'center_lat_lon':region_info[region]['center'],'patches':len(new_rows),
   'inventory_date':region_info[region]['inventory_date'],'reference':before,'fine_tuned':after,
   'iou_change':after['pixel_iou']-before['pixel_iou'],
   'share_of_test_positive_pixels':(after['tp']+after['fn'])/(candidate['tp']+candidate['fn'])})
 # Each pixel's count must reconcile with the original frozen aggregate.
 for report_key,region_key in [(reference,'reference'),(candidate,'fine_tuned')]:
  total=aggregate([r[region_key] for r in rows])
  for k in ['tp','fp','fn','tn']:assert total[k]==report_key[k],k
 leave_out=[]
 for omitted in report['test_regions']:
  others=[r for r in rows if r['region']!=omitted]
  before=aggregate([r['reference'] for r in others]);after=aggregate([r['fine_tuned'] for r in others])
  leave_out.append({'omitted_region':omitted,'reference_iou':before['pixel_iou'],'fine_tuned_iou':after['pixel_iou'],'iou_change':after['pixel_iou']-before['pixel_iou']})
 torch.set_num_threads(2)
 saved=torch.load(run/'best.pt',map_location='cpu',weights_only=False)
 if saved['dataset_sha256']!=sha(run/'dataset.json'):raise ValueError('Frozen training dataset changed')
 model=LocalModel();model.load_state_dict(saved['model']);model=model.to('mps')
 val=predict(model,ReviewedDataset(doc,'val'),'mps')
 optimum,sweep=calibrate(val[0][val[2]],val[1][val[2]])
 if optimum['confidence']!=saved['threshold']:raise ValueError('Validation threshold did not reproduce')
 test=ReviewedDataset(doc,'test');arrays=predict(model,test,'mps');reproduced=summarize(arrays,saved['threshold'])
 for key in ['tp','fp','fn','tn']:
  if reproduced[key]!=candidate[key]:raise ValueError('Test inference did not reproduce: '+key)
 np.savez_compressed(out/'frozen_predictions.npz',validation_probabilities=val[0],validation_truth=val[1],validation_valid=val[2],validation_ids=val[3],test_probabilities=arrays[0],test_truth=arrays[1],test_valid=arrays[2],test_ids=arrays[3])
 with (out/'validation_threshold_sweep.csv').open('w',newline='') as f:
  writer=csv.DictWriter(f,fieldnames=list(sweep[0]));writer.writeheader();writer.writerows(sweep)
 near=[r['confidence'] for r in sweep if r['pixel_iou']>=optimum['pixel_iou']-.01]
 summary={'checkpoint_sha256':report['checkpoint_sha256'],'dataset_sha256':sha(run/'dataset.json'),
  'reference_type':doc['reference_type'],'per_region':rows,'leave_one_region_out':leave_out,
  'macro_region_iou':{name:float(np.mean([r[name]['pixel_iou'] for r in rows])) for name in ['reference','fine_tuned']},
  'validation_threshold':optimum,'validation_thresholds_within_one_iou_point':near,
  'validation_iou_at_0_5':next(r for r in sweep if r['confidence']==.5)['pixel_iou'],
  'test_inference_reproduced':True,'counts_reconciled':True,'scored_test_pixels':candidate['tp']+candidate['fp']+candidate['fn']+candidate['tn'],
  'ignored_test_pixels':candidate['ignored_pixels'],'threshold_changed':False,'app_integration':False,
  'limits':doc['limits']+['Only three test regions: no reliable nationwide confidence interval.',
    'Errors are relative to the buffered official inventory labels; unknown boundaries are not scored.',
    'A score threshold of 0.024 is not a calibrated 2.4% landslide probability.']}
 write(out/'audit.json',summary)
 import matplotlib;matplotlib.use('Agg')
 import matplotlib.pyplot as plt
 fig,axes=plt.subplots(1,2,figsize=(12,4.5),layout='constrained')
 x=np.arange(len(rows))
 for shift,key,label in [(-.18,'reference','Frozen transfer'),(.18,'fine_tuned','Taiwan fine-tuned')]:
  bars=axes[0].bar(x+shift,[r[key]['pixel_iou']*100 for r in rows],.36,label=label)
  axes[0].bar_label(bars,fmt='%.1f%%',padding=3)
 axes[0].set_xticks(x,[r['region'] for r in rows]);axes[0].set_ylim(0,80);axes[0].set_ylabel('IoU (%)');axes[0].legend();axes[0].set_title('Every held-out region')
 axes[1].plot([r['confidence'] for r in sweep],[r['pixel_iou']*100 for r in sweep]);axes[1].axvline(saved['threshold'],color='darkorange',linestyle='--',label=f'Frozen threshold {saved["threshold"]}')
 axes[1].set_xscale('log');axes[1].set_xlabel('Model score threshold (log scale)');axes[1].set_ylabel('Validation IoU (%)');axes[1].set_title('Validation only — no test threshold tuning');axes[1].legend()
 fig.savefig(out/'region_and_threshold_audit.png',dpi=150);plt.close(fig)
 history=json.loads((run/'history.json').read_text());fig,axes=plt.subplots(1,2,figsize=(10,4),layout='constrained')
 axes[0].plot([r['epoch'] for r in history],[r['loss'] for r in history]);axes[0].set_title('Training loss')
 axes[1].plot([r['epoch'] for r in history],[r['pixel_iou']*100 for r in history]);axes[1].set_title('Threshold-tuned validation IoU (%)')
 for ax in axes:ax.set_xlabel('Epoch');ax.axvline(saved['epoch'],linestyle='--',color='orange')
 fig.savefig(out/'learning_curves.png',dpi=150);plt.close(fig)
 chosen=[]
 for region in report['test_regions']:
  group=[r for r in candidate['per_image'] if samples[r['id']]['region']==region]
  for metric in ['fp','fn']:
   worst=max(group,key=lambda r:(r[metric],r['id']))
   chosen.append((worst,f'{region}: most {"extra" if metric=="fp" else "missed"} labeled pixels'))
 fig,axes=plt.subplots(len(chosen),3,figsize=(10,3.2*len(chosen)),squeeze=False,layout='constrained')
 for i,(row,title) in enumerate(chosen):
  idx=arrays[3].index(row['id']);p=arrays[0][idx]>np.float32(saved['threshold']);truth=arrays[1][idx];valid=arrays[2][idx]
  rgb=np.array(Image.open(Path(samples[row['id']]['image_path']).parent/'rgb.png'))
  label=np.full_like(rgb,30);label[valid]=[210,210,210];label[valid&truth]=[230,140,25]
  error=(rgb*.4).astype(np.uint8);error[~valid]=[30,30,30]
  error[valid&p&truth]=[65,190,100];error[valid&p&~truth]=[255,65,80];error[valid&~p&truth]=[70,145,255]
  for j,img in enumerate([rgb,label,error]):axes[i,j].imshow(img);axes[i,j].axis('off')
  axes[i,0].set_title(title+'\n'+row['id'],fontsize=10)
  axes[i,1].set_title('Inventory reference; dark = ignored',fontsize=10)
  axes[i,2].set_title(f'Extra: {row["fp"]}; missed: {row["fn"]} pixels',fontsize=10)
 fig.suptitle('Fixed-model error audit: green = match, red = extra, blue = missed\nWorst false-positive and false-negative patch per region; duplicate rows may occur',fontsize=11)
 fig.savefig(out/'error_examples.png',dpi=120);plt.close(fig)
 lines=['Frozen Taiwan model audit','',f'Checkpoint: {run/"best.pt"}',
  'Evaluation compares a frozen 13-channel transfer to the Taiwan-fine-tuned 13-channel model.',
  'The original 14-channel benchmark score is not the comparator here.','',
  'Region | Reference IoU | Fine-tuned IoU | Reference FP | Fine-tuned FP']
 for r in rows:lines.append(f'{r["region"]} | {r["reference"]["pixel_iou"]:.2%} | {r["fine_tuned"]["pixel_iou"]:.2%} | {r["reference"]["fp"]} | {r["fine_tuned"]["fp"]}')
 lines+=['',f'Validation-selected threshold remains {saved["threshold"]}; it is not a calibrated probability.',
  f'Validation IoU: {optimum["pixel_iou"]:.2%}; test IoU: {candidate["pixel_iou"]:.2%}.',
  f'Macro region IoU: {summary["macro_region_iou"]["fine_tuned"]:.2%}.',
  'All region sums reconcile; frozen validation threshold and test counts reproduce exactly.',
  'Improvement in all three regions does not imply lower false positives in every region.',
  'Reference boundaries/clouds/unknown areas are excluded; this does not measure full-boundary segmentation quality.',
  'Next useful evidence: independently reviewed 2026 imagery and additional geographic holdouts.',
  'No retraining, new checkpoint selection, threshold changes or application changes were made.']
 (out/'README.txt').write_text('\n'.join(lines)+'\n')
 print(json.dumps({'audit':str(out),'per_region':rows,'macro_region_iou':summary['macro_region_iou'],
  'validation_near_best_threshold_range':[min(near),max(near)],'validation_iou_at_0_5':summary['validation_iou_at_0_5']}))

if __name__=='__main__':main()
