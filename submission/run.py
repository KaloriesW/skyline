"""Portable local launcher: python run.py [--port 8765]."""
import argparse
import os
from pathlib import Path

if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port',type=int,default=8765)
    args=parser.parse_args()
    os.chdir(Path(__file__).resolve().parent)
    import uvicorn
    uvicorn.run('app:app',host='127.0.0.1',port=args.port)
