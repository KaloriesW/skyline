from pathlib import Path
import csv
import matplotlib.pyplot as plt
p=Path(__file__).parent/'yolo11l-seg-sentinel2-448'
rows=[{k.strip():float(v) for k,v in r.items()} for r in csv.DictReader((p/'results.csv').open())]
fig,axes=plt.subplots(1,2,figsize=(10,3.5),layout='constrained')
for key,label in [('train/seg_loss','Train'),('val/seg_loss','Validation')]:axes[0].plot([r['epoch'] for r in rows],[r[key] for r in rows],label=label)
axes[0].set(title='Segmentation loss',xlabel='Completed epoch',ylabel='Loss');axes[0].legend()
for key,label in [('metrics/mAP50(M)','Mask mAP50'),('metrics/mAP50-95(M)','Mask mAP50–95')]:axes[1].plot([r['epoch'] for r in rows],[r[key]*100 for r in rows],label=label)
axes[1].set(title='Validation instance metrics',xlabel='Completed epoch',ylabel='Percent');axes[1].legend()
for ax in axes:ax.grid(alpha=.25)
fig.suptitle('Historical YOLO11l-seg Sentinel-2 experiment — 16 recorded epochs')
fig.savefig(p/'training-curves.png',dpi=160)
