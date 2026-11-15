"""Locked data preparation and isolated training; no app promotion."""
import fcntl, os, traceback
from prepare_inventory import HERE, prepare_all, status

def main():
 with (HERE/'pipeline.lock').open('a') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
  status(state='starting',pid=os.getpid())
  dataset=prepare_all()
  from train_inventory import train
  train(dataset)

if __name__=='__main__':
 try:main()
 except Exception as exc:
  status(state='failed',error=str(exc),traceback=traceback.format_exc());raise
