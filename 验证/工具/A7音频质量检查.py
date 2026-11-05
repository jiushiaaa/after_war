# Read-only technical checks of generated originals. Not a human listening review.
import array,json,math,pathlib,subprocess,tempfile,wave
root=pathlib.Path('游戏/audio/postwar');out=[]
for item in json.loads((root/'manifest.json').read_text()):
 p=root/item['file']
 if not p.exists():out.append({'id':item['id'],'missing':True});continue
 with tempfile.TemporaryDirectory(prefix='postwar-a7-audio-') as tmp:
  wav=pathlib.Path(tmp)/'decoded.wav'
  subprocess.run(['/usr/bin/afconvert','-f','WAVE','-d','LEI16',str(p),str(wav)],check=True,capture_output=True)
  with wave.open(str(wav)) as w:
   rate,channels,frames=w.getframerate(),w.getnchannels(),w.getnframes();peak=clipped=count=power=0
   while data:=w.readframes(rate*5):
    a=array.array('h',data);count+=len(a);peak=max(peak,max(map(abs,a),default=0));clipped+=sum(abs(x)>=32760 for x in a);power+=sum(x*x for x in a)
  raw=p.read_bytes();out.append({'id':item['id'],'file':p.name,'seconds':frames/rate,'channels':channels,'rate':rate,'bytes':len(raw),'aigcHeader':b'AIGC' in raw[:65536] or b'aigc' in raw[:65536],'peak':peak/32768,'rmsDb':20*math.log10(math.sqrt(power/max(1,count))/32768) if power else None,'clippedFraction':clipped/max(1,count)})
path=pathlib.Path('验证/A7/5-音频');path.mkdir(parents=True,exist_ok=True)
(path/'解码与电平.json').write_text(json.dumps({'kind':'technical checks, not human listening','tracks':out,'actualSeconds':sum(x.get('seconds',0) for x in out)},ensure_ascii=False,indent=2))
print(json.dumps({'files':sum(not x.get('missing') for x in out),'seconds':sum(x.get('seconds',0) for x in out),'missing':[x['id'] for x in out if x.get('missing')],'clipped':[x['id'] for x in out if x.get('clippedFraction',0)>.001]},ensure_ascii=False))
