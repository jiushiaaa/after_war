// Release only the playable game. Drafts, natural saves and test tooling stay local.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'dist'),files=new Set(['index.html','favicon.ico','LICENSE.md','UPSTREAM.md']);
const html=await fs.readFile(path.join(root,'index.html'),'utf8');
for(const [,url] of html.matchAll(/(?:src|href|content)="([^"]+)"/g)){
  if(!/\.(?:js|css|ico|png)(?:\?|$)/.test(url))continue;
  if(/^(?:https?:)?\/\//.test(url))throw Error('Remote runtime asset: '+url);
  files.add(url.split('?')[0]);
}
for(const f of await fs.readdir(path.join(root,'css')))if(f.endsWith('.css'))files.add('css/'+f);
for(const f of await fs.readdir(path.join(root,'audio')))if(f.endsWith('.flac'))files.add('audio/'+f);
for(const f of await fs.readdir(path.join(root,'audio/postwar')))if(f.endsWith('.mp3')||f==='CREDITS.md')files.add('audio/postwar/'+f);
// Language and theme files may also be requested by the original ADR loader.
for(const f of await fs.readdir(path.join(root,'lang/zh_cn')))if(/\.(js|css)$/.test(f))files.add('lang/zh_cn/'+f);
const rows=[];
for(const name of [...files].sort()){
  const source=path.resolve(root,name);
  if(!source.startsWith(root+path.sep))throw Error('Asset outside game: '+name);
  const bytes=await fs.readFile(source),limit=name.endsWith('.html')?5e6:/\.(png|jpe?g|webp|gif)$/.test(name)?10e6:100e6;
  if(bytes.length>limit)throw Error('Asset exceeds platform size limit: '+name);
  rows.push({path:name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
}
await fs.rm(out,{recursive:true,force:true});
for(const row of rows){const to=path.join(out,row.path);await fs.mkdir(path.dirname(to),{recursive:true});await fs.copyFile(path.join(root,row.path),to);}
await fs.mkdir(path.join(root,'.build'),{recursive:true});
await fs.writeFile(path.join(root,'.build/manifest.json'),JSON.stringify({version:JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8')).version,files:rows},null,2)+'\n');
console.log(JSON.stringify({files:rows.length,bytes:rows.reduce((sum,r)=>sum+r.bytes,0),output:out}));
