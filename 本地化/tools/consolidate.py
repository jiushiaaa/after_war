"""Recover valid individual entries; never pay again for intact cached translations."""
import json,re
from pathlib import Path
p=Path(__file__).resolve().parents[1]/'英文全稿';inputs=json.loads((p/'batch-inputs.json').read_text());source={r['id']:r for batch in inputs for r in batch};rows={}
def take(data):
 if not isinstance(data,list):return
 for row in data:
  if not isinstance(row,dict) or row.get('id') not in source or not isinstance(row.get('text'),str) or not row['text'].strip():continue
  left=source[row['id']]['text'];right=row['text']
  if sorted(re.findall(r'\{[^{}]+\}',left))!=sorted(re.findall(r'\{[^{}]+\}',right)):continue
  rows.setdefault(row['id'],{'id':row['id'],'text':right})
for pattern in ['[0-9][0-9][0-9].json','*-part*.json','fill-*.json','*.rejected.txt']:
 for f in sorted((p/'batches').glob(pattern)):
  if '.usage.' in f.name:continue
  try:take(json.loads(f.read_text()))
  except (ValueError,UnicodeDecodeError):pass
written=[]
for i,batch in enumerate(inputs):
 f=p/'batches'/('%03d.json'%i)
 if not f.exists() and all(row['id'] in rows for row in batch):f.write_text(json.dumps([rows[r['id']] for r in batch],ensure_ascii=False,indent=2)+'\n');written.append(i)
missing=[row for batch in inputs for row in batch if row['id'] not in rows]
(p/'remaining-input.json').write_text(json.dumps(missing,ensure_ascii=False,indent=2)+'\n')
print('Recovered complete batches',written,'remaining individual entries',len(missing))
