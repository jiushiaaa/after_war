// Local test entry only. Native exports are read-only and individually allowlisted.
import {readFile,realpath} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';

export async function testRoute(req,res,name,root) {
  if(name!=='/test-game.html' && name!=='/test.html' && !name.startsWith('/testing/saves/'))return false;
  if(!['GET','HEAD'].includes(req.method)) {res.writeHead(405,{Allow:'GET, HEAD'});res.end();return true;}
  const send=(status,type,data)=>{res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:data);};
  try {
    if(name==='/test.html') {
      send(200,'text/html; charset=utf-8',await readFile(path.join(root,'体验测试.html')));return true;
    }
    if(name==='/test-game.html') {
      const html=await readFile(path.join(root,'index.html'),'utf8');
      // The production entry is unchanged. The preview wrapper runs before DOM-ready boot.
      send(200,'text/html; charset=utf-8',html.replace('</head>','<link rel="stylesheet" href="testing/session.css"><script src="testing/session.js"></script>\n</head>'));return true;
    }
    const id=name.match(/^\/testing\/saves\/([a-z0-9-]+)\.json$/)?.[1];
    const catalog=JSON.parse(await readFile(path.join(root,'testing/catalog.json'),'utf8'));
    const entry=catalog.scenarios.find(s=>s.id===id&&s.source);
    if(!entry) {send(404,'text/plain; charset=utf-8','未找到这个测试节点');return true;}
    const repo=path.dirname(root),verify=await realpath(path.join(repo,'验证'));
    const file=await realpath(path.resolve(repo,entry.source));
    if(!file.startsWith(verify+path.sep))throw Error('source outside evidence directory');
    const bytes=await readFile(file);
    if(createHash('sha256').update(bytes).digest('hex')!==entry.sha256) {
      send(409,'text/plain; charset=utf-8','原始验收档与目录校验不符，未加载。请检查文件完整性。');return true;
    }
    send(200,'application/json; charset=utf-8',bytes);return true;
  } catch {
    send(404,'text/plain; charset=utf-8','测试文件缺失。请使用完整仓库，并在“游戏”目录运行 npm run dev。');return true;
  }
}
