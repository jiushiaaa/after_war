"""Compile only validated catalog entries; partial output is for local preview only."""
import json,re,argparse
from pathlib import Path
root=Path(__file__).resolve().parents[1];p=root/'英文全稿'
args=argparse.ArgumentParser();args.add_argument('--partial',action='store_true');args=args.parse_args()
source=json.loads((p/'source.json').read_text());byid={x['id']:x for x in source};translated={};issues=[]
for file in sorted((p/'batches').glob('[0-9][0-9][0-9].json')):
 if '.usage.' in file.name:continue
 for row in json.loads(file.read_text()):
  if row['id'] not in byid:raise ValueError('unknown id')
  if row['id'] in translated:raise ValueError('duplicate id')
  translated[row['id']]=row['text']
# Manually reviewed seed corrections take precedence over machine drafts.
review=json.loads((root/'英文验证/sample-reviewed.json').read_text());inputs=json.loads((root/'英文验证/sample-input.json').read_text());fixes={a['text']:b['text'] for a,b in zip(inputs,review)}
overrides=p/'reviewed-overrides.json'
if overrides.exists():fixes.update(json.loads(overrides.read_text()))
approved=json.loads((p/'numeric-reviewed.json').read_text()) if (p/'numeric-reviewed.json').exists() else {}
strip=lambda s:re.sub(r'\{[^{}]+\}','',s)
rows=[];canonical={};canonicalized=[]
for row in source:
 s=row['text'];t=fixes.get(s,translated.get(row['id']))
 if t is None:continue
 slots=list(dict.fromkeys(re.findall(r'\{[^{}]+\}',s)))
 if slots:
  token={v:'§S'+str(i)+'§' for i,v in enumerate(slots)}
  key=re.sub(r'\{[^{}]+\}',lambda m:token[m[0]],s)
  if key in canonical:
   unified=canonical[key]
   for i,v in enumerate(slots):unified=unified.replace('§S'+str(i)+'§',v)
   if unified!=t:canonicalized.append({'id':row['id'],'source':s,'original':t,'text':unified})
   t=unified
  else:canonical[key]=re.sub(r'\{[^{}]+\}',lambda m:token.get(m[0],m[0]),t)
 if sorted(re.findall(r'\{[^{}]+\}',s))!=sorted(re.findall(r'\{[^{}]+\}',t)):issues.append({'id':row['id'],'reason':'placeholders','source':s,'text':t});continue
 if re.search(r'[\u4e00-\u9fff]',strip(t)):issues.append({'id':row['id'],'reason':'Chinese remains','source':s,'text':t})
 if sorted(re.findall(r'\d+(?:\.\d+)?',strip(s)))!=sorted(re.findall(r'\d+(?:\.\d+)?',strip(t))) and not (approved.get(row['id'],{}).get('source')==s and approved.get(row['id'],{}).get('text')==t):issues.append({'id':row['id'],'reason':'numeric literals','source':s,'text':t})
 for group in re.findall(r'(?:\{[^{}]+\}){2,}',s):
  if group not in t:issues.append({'id':row['id'],'reason':'adjacent dynamic values separated','source':s,'text':t})
 t=t.replace('。','.').replace('，',', ').replace('：',': ').replace('；','; ').replace('（',' (').replace('）',')').replace('、',', ')
 rows.append({'source':s,'text':t})
(p/'canonicalized.json').write_text(json.dumps(canonicalized,ensure_ascii=False,indent=2)+'\n')
(p/'quality-issues.json').write_text(json.dumps(issues,ensure_ascii=False,indent=2)+'\n')
missing=[x['id'] for x in source if x['id'] not in translated and x['text'] not in fixes]
(p/'missing.json').write_text(json.dumps(missing))
usage={'prompt_tokens':0,'completion_tokens':0,'total_tokens':0}
for file in (p/'batches').glob('*.usage.json'):
 u=json.loads(file.read_text())
 for k in usage:usage[k]+=u.get(k,0)
print(json.dumps({'entries':len(rows),'missing':len(missing),'issues':len(issues),'usage':usage}))
if not args.partial and (missing or issues):raise SystemExit('Catalog is not release-ready; no production catalog written.')
for source,text in {'燧人':'Suiren','吨':'tonnes','千克':'kg','人':'people','万':'ten thousand','亿':'hundred million'}.items():
 if not any(row['source']==source for row in rows):rows.append({'source':source,'text':text})
supplements=json.loads((p/'ui-supplements.json').read_text())
for source,text in supplements.items():
 rows=[row for row in rows if row['source']!=source]
 rows.append({'source':source,'text':text})
output=root.parent/'游戏/content/english.js'
output.write_text('/* MPL-2.0 — AI-assisted English localization; see 本地化. */\nvar CivilEnglishText = '+json.dumps(rows,ensure_ascii=False,separators=(',',':'))+';\n')
