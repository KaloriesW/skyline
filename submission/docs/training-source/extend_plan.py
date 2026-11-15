"""Add spatially separate reserves before model fitting; never reshuffle old splits."""
import collections,json,math
import numpy as np
from prepare_inventory import HERE, SIDE, inventory, transform, verify_plan, write, sha

def extend():
 plan=json.loads((HERE/'plan.json').read_text())
 if plan.get('revision')==2:return plan
 if (HERE/'dataset.json').exists() or (HERE/'runs').exists():raise ValueError('Cannot extend after dataset freeze or model fitting')
 reader=inventory();records=[v.as_dict() for v in reader.iterRecords()];reader.close()
 xs,ys=transform('EPSG:3826','EPSG:32651',[r['X'] for r in records],[r['Y'] for r in records])
 groups=collections.defaultdict(list)
 for i,(x,y) in enumerate(zip(xs,ys)):groups[(math.floor(x/SIDE),math.floor(y/SIDE))].append(i)
 candidates=[]
 for (x,y),ids in groups.items():
  day,n=collections.Counter(records[i]['DATE'] for i in ids).most_common(1)[0]
  if n>=8 and n/len(ids)>=.85:candidates.append({'x':x*SIDE,'y':y*SIDE,'inventory_date':day,'polygon_count':n,'date_purity':n/len(ids)})
 candidates.sort(key=lambda r:(-r['polygon_count'],r['x'],r['y']))
 reserves=[]
 for row in candidates:
  if all(math.hypot(row['x']-r['x'],row['y']-r['y'])>=16000 for r in plan['regions']+reserves):reserves.append(row)
 order=np.random.default_rng(2024).permutation(len(reserves));hold=max(2,len(reserves)//5)
 splits={int(i):('test' if j<hold else 'val' if j<2*hold else 'train') for j,i in enumerate(order)}
 offset=len(plan['regions'])
 for i,row in enumerate(reserves):
  row.update(id=f'block_{offset+i:02d}',split=splits[i])
  lon,lat=transform('EPSG:32651','EPSG:4326',[row['x']+SIDE/2],[row['y']+SIDE/2]);row['center']=[lat[0],lon[0]]
 write(HERE/'plan_initial.json',plan)
 plan['initial_plan_sha256']=sha(HERE/'plan_initial.json')
 plan.update(revision=2,reserve_seed=2024,extension_reason='Insufficient clear imagery in the initial pilot; fixed additional splits before any training or test inference.')
 plan['regions']+=reserves;verify_plan(plan);write(HERE/'plan.json',plan)
 return plan

if __name__=='__main__':
 import fcntl
 with (HERE/'pipeline.lock').open('a') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
  p=extend();print('Regions',len(p['regions']),dict(collections.Counter(r['split'] for r in p['regions'])))
