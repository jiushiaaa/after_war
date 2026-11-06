// A7 closure: independent normal UI lineage. Earlier deliberate-crisis evidence remains separate.
// Only native UI inputs. Continues the same fresh world; no save/resource/time injection.
import fs from 'node:fs';import path from 'node:path';import {connect} from '../a7-cdp.mjs';import {handlePolish} from '../a7-decisions.mjs';
const [port,dir]=process.argv.slice(2),b=await connect(port,dir),route=process.env.A7_ROUTE==='public'?'public':'industrial';
await b.send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
const deadline=Date.now()+90*60000;let last=-1,complete=false;
while(Date.now()<deadline){
 if(await handlePolish({...b,route}))continue;
 const s=await b.read('({at:State.civilization.elapsed,pending:State.civilization.pending,event:Events.activeEvent()?.title,paused:CivilClock.paused,speed:State.civilization.speed,max:State.civilization.maxSpeed,research:State.civilization.research,tech:State.civilization.tech,modern:State.civilization.modern,stores:State.stores})');
 if(s.event){const key={cold:'wood',roadIncident:'repair',succession:'engineer'}[s.pending];if(!key||!await b.raw('#event #'+key))throw Error('Unhandled '+s.pending);continue;}
 const missing=['semiconductor','electroalloy','powerstorage','systemsafety'].filter(k=>!s.tech[k]);
 if(!missing.length){complete=true;break;}
 if(s.paused||s.speed<s.max){await b.click('#speedButton');await b.raw(s.paused?'#event #pause':'#event #speed_'+s.max);continue;}
 if(s.at-last>=120){last=s.at;b.log('snapshot',{...s,missing});console.log(JSON.stringify({at:s.at,missing,research:s.research,knowledge:s.stores.knowledge,parts:s.stores.parts}));}
 if(!s.research)for(const id of missing){if(await b.click('#research_'+id))break;}
 await b.sleep(1200);
}
if(!complete)throw Error('Late research incomplete; retain original live world');
await b.click('#speedButton');await b.raw('#event #pause');fs.mkdirSync(path.join(dir,'native'),{recursive:true});await b.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:path.resolve(dir,'native')});await b.click('#saveMenu');await b.raw('#event #download');await b.sleep(1200);await b.raw('#event #close');
fs.writeFileSync(path.join(dir,'result.json'),JSON.stringify(await b.read('({at:State.civilization.elapsed,tech:State.civilization.tech,modern:State.civilization.modern})'),null,2));b.close();
