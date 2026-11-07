import importlib.util,json,concurrent.futures,argparse
from pathlib import Path
spec=importlib.util.spec_from_file_location('translator',Path(__file__).with_name('translate.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
p=argparse.ArgumentParser();p.add_argument('indices',nargs='+',type=int);p.add_argument('--workers',type=int,default=2);args=p.parse_args();batches=json.loads((m.ROOT/'batch-inputs.json').read_text())
jobs=[]
for i in args.indices:
 if (m.ROOT/'batches'/('%03d.json'%i)).exists():continue
 for j in range(0,len(batches[i]),20):jobs.append((i,batches[i][j:j+20],'%03d-part%02d'%(i,j//20)))
with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
 fs={pool.submit(m.run,j):j[2] for j in jobs}
 for f in concurrent.futures.as_completed(fs):
  try:print(fs[f],f.result(),flush=True)
  except Exception as e:print('FAILED',fs[f],str(e)[:100],flush=True)
for i in args.indices:
 paths=[m.ROOT/'batches'/('%03d-part%02d.json'%(i,j//20)) for j in range(0,len(batches[i]),20)]
 if not all(p.exists() for p in paths):continue
 rows=sum([json.loads(p.read_text()) for p in paths],[]);m.validate(batches[i],rows)
 (m.ROOT/'batches'/('%03d.json'%i)).write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n');print('recovered',i,flush=True)
