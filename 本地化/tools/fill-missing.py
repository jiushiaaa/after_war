import importlib.util,json,concurrent.futures,argparse,hashlib,subprocess,sys
from pathlib import Path
spec=importlib.util.spec_from_file_location('translator',Path(__file__).with_name('translate.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
p=argparse.ArgumentParser();p.add_argument('--parents',nargs='*',type=int);p.add_argument('--workers',type=int,default=2);args=p.parse_args()
subprocess.run([sys.executable,str(Path(__file__).with_name('consolidate.py'))],check=True)
rows=json.loads((m.ROOT/'remaining-input.json').read_text())
if args.parents:
 batches=json.loads((m.ROOT/'batch-inputs.json').read_text());allowed={r['id'] for i in args.parents for r in batches[i]};rows=[r for r in rows if r['id'] in allowed]
jobs=[]
for i in range(0,len(rows),20):
 batch=rows[i:i+20];label='fill-'+hashlib.sha256('|'.join(r['id'] for r in batch).encode()).hexdigest()[:12];jobs.append((i,batch,label))
print('Individual missing entries',len(rows),'requests',len(jobs),flush=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
 fs={pool.submit(m.run,j):j[2] for j in jobs}
 for f in concurrent.futures.as_completed(fs):
  try:print(fs[f],f.result(),flush=True)
  except Exception as e:print('FAILED',fs[f],str(e)[:100],flush=True)
subprocess.run([sys.executable,str(Path(__file__).with_name('consolidate.py'))],check=True)
