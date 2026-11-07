const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..'),copy=x=>JSON.parse(JSON.stringify(x));
function harness(){
  const s=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/natural-passenger-construction.json'),'utf8')).state;
  const calls=[],ctx=vm.createContext({State:s,_:x=>x});let active=null;
  ctx.Events={activeEvent:()=>active,startEvent(event,options){calls.push({event,options});active=event;event.eventPanel={classes:[],addClass(name){this.classes.push(name);return this;}};}};
  for(const file of ['content/zh.js','content/development.js','content/industry.js','content/regions.js','content/urban.js','content/origins.js','content/municipal.js','content/advanced.js','content/services.js','src/postwar/history.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file});
  return {s,ctx,history:ctx.CivilHistory,calls,setActive(value){active=value;}};
}
function dom(h){
  const elements=new Map();
  function element(exists=true){return {length:exists?1:0,attributes:{},classes:new Set(),handlers:{},value:'',
    first(){return this;},attr(key,value){if(typeof key==='object'){Object.assign(this.attributes,key);if(key.id)elements.set('#'+key.id,this);return this;}if(value===undefined)return this.attributes[key];this.attributes[key]=value;return this;},
    addClass(name){this.classes.add(name);return this;},toggleClass(name,on){if(on)this.classes.add(name);else this.classes.delete(name);return this;},text(value){this.value=value;return this;},appendTo(parent){this.parent=parent;return this;},on(name,fn){this.handlers[name]=fn;return this;},remove(){if(this.attributes.id)elements.delete('#'+this.attributes.id);this.length=0;return this;}};}
  elements.set('.menu',element());h.ctx.$=selector=>typeof selector==='string'&&selector.startsWith('<')?element():elements.get(selector)||element(false);
  return elements;
}
function freeze(value){if(value&&typeof value==='object'){Object.freeze(value);for(const child of Object.values(value))freeze(child);}return value;}

test('history derives detached views from the original natural save without creating or changing any saved state',()=>{
  const {s,history}=harness(),before=JSON.stringify(s);freeze(s);
  const first=history.snapshot(s),second=history.snapshot(s);assert.deepEqual(copy(first),copy(second));assert.equal(JSON.stringify(s),before);assert.equal(s.civilization.history,undefined);
  assert.equal(first.counts.tenures,s.civilization.society.history.length+1);assert.equal(first.counts.technology,Object.values(s.civilization.tech).filter(Boolean).length);
  first.entries[0].title='changed view';assert.notEqual(history.snapshot(s).entries[0].title,'changed view');history.event(s);assert.equal(JSON.stringify(s),before);
});
test('all original terms remain visible and a death-related handover does not invent the year of death',()=>{
  const {s,history}=harness(),x=s.civilization.society;x.leader.alive=false;
  const view=history.snapshot(s),terms=view.entries.filter(e=>e.category==='tenures');
  for(const record of x.history){const term=terms.find(e=>e.generation===record.generation);assert.equal(term.from,record.from);assert.equal(term.to,record.to);assert.equal(term.at,null);assert.ok(history.line(term).includes(record.from+'—'+record.to+' 年'));if(record.reason==='death'){assert.match(term.detail,/离世而完成交接/);assert.doesNotMatch(term.detail,/于.*年.*离世/);}}
  const current=terms.find(e=>e.current);assert.equal(current.from,x.leader.started);assert.equal(current.to,null);assert.match(current.detail,/未详录卒年/);assert.match(history.event(s).scenes.start.text.join('\n'),/政策与制度改革尚无完整记录/);
});
test('technology and city flags remain undated and source introduction is never reused as an agreement date',()=>{
  const {s,history}=harness(),c=s.civilization;c.urban.city=true;c.urban.chartered=true;
  const river=c.origins.nodes.river_network;river.status='agreed';river.permit.paid=true;delete river.agreement;river.introducedAt=600;
  const old=c.origins.nodes.old_city_fringe;old.status='agreed';old.permit.paid=true;old.agreement={agreedAt:1201,home:{knowledge:20},source:{wood:10,knowledge:10}};
  const view=history.snapshot(s);for(const entry of view.entries.filter(e=>e.category==='technology'||e.category==='cities')){assert.equal(entry.at,null);assert.match(history.line(entry),/未记年/);}
  const legacy=view.entries.find(e=>e.key==='origin_agreement_river_network'),known=view.entries.find(e=>e.key==='origin_agreement_old_city_fringe');assert.equal(legacy.at,null);assert.equal(known.at,1201);assert.equal(history.date(known),'重建 2 年');assert.match(known.detail,/本地实付：知识 20/);assert.match(known.detail,/来源实付：木料 10、知识 10/);
});
test('only contacted sources and discovered towns expose completed records; paid in-progress projects never become achievements',()=>{
  const {s,history}=harness(),c=s.civilization;c.origins.nodes.old_city_fringe.status='unknown';c.origins.nodes.old_city_fringe.schooling.completed=[{startedAt:10,completedAt:200,paid:{wood:120,tools:12,knowledge:20}}];
  c.regions.nodes.rail.discovered=false;c.municipal.nodes.rail.completed.push({id:998,type:'residential',completedAt:300});
  c.services.nodes.home.project={id:999,type:'densehousing',status:'building',remaining:1};
  const view=history.snapshot(s);assert.ok(!view.entries.some(e=>e.key.startsWith('origin_school_old_city_fringe')));assert.ok(!view.entries.some(e=>e.key.startsWith('municipal_rail_')));assert.ok(!view.entries.some(e=>e.key==='services_home_999'));
  c.origins.nodes.old_city_fringe.status='contacted';assert.equal(history.snapshot(s).entries.find(e=>e.key==='origin_school_old_city_fringe_1').at,200);
});
test('municipal services schools and freight use their own completion records without date guesses or duplicate IDs',()=>{
  const {s,history}=harness(),c=s.civilization;c.municipal.nodes.river.completed=[{id:1,type:'residential',completedAt:600}];c.services.nodes.river={completed:[{id:1,type:'waterworks',completedAt:1200}]};
  c.regions.projects.river={status:'complete',required:{wood:80},receipts:[{at:100}]};c.regions.upgrades.projects.river={id:1,status:'complete',completedAt:1800};
  c.services.nodes.home.completed=[{id:1,type:'passengerfleet',completedAt:2400,paid:{wood:180,iron:40,steel:24,parts:16,tools:20}},{id:2,type:'pharmacy',completedAt:c.elapsed+1}];
  const view=history.snapshot(s),get=id=>view.entries.find(e=>e.key===id);assert.equal(get('municipal_river_1').at,600);assert.equal(get('services_river_1').at,1200);assert.equal(get('public_project_river').at,null);assert.equal(get('freight_upgrade_river_1').at,1800);assert.equal(get('services_home_1').at,2400);assert.equal(get('services_home_2').at,null);assert.match(get('services_home_1').detail,/钢材 24/);assert.equal(new Set(view.entries.map(e=>e.key)).size,view.entries.length);
});
test('native history pages reset only reading position and never grant rewards or spend resources',()=>{
  const {s,history}=harness(),event=history.event(s),terms=Object.entries(event.scenes).filter(([key])=>key.startsWith('tenures_'));
  assert.ok(terms.length>=2);assert.ok(event.scenes.start.text.length<=history.PAGE_SIZE+3);assert.ok(event.scenes.start.buttons.history_tenures);assert.ok(event.scenes.start.buttons.history_technology);
  for(const [name,scene]of Object.entries(event.scenes)){if(name!=='start')assert.ok(scene.text.length<=history.PAGE_SIZE+1);assert.ok(scene.text.every(t=>typeof t==='string'));assert.equal(scene.reward,undefined);assert.equal(typeof scene.onLoad,'function');scene.onLoad();
    for(const button of Object.values(scene.buttons)){assert.equal(button.cost,undefined);assert.equal(button.onChoose,undefined);assert.equal(button.onClick,undefined);if(button.nextScene!=='end'){assert.deepEqual(Object.keys(button.nextScene),['1']);assert.ok(event.scenes[button.nextScene[1]]);}}
  }
});
test('opening never interrupts a live event or pending decision and does not change stores population or history',()=>{
  const h=harness(),{s,history}=h,before=JSON.stringify(s);h.setActive({title:'真实事件'});assert.equal(history.open(s),false);assert.equal(h.calls.length,0);h.setActive(null);s.civilization.pending='succession';assert.equal(history.open(s),false);assert.equal(h.calls.length,0);s.civilization.pending=null;
  assert.equal(history.open(s),true);assert.equal(h.calls.length,1);assert.equal(h.calls[0].event.civilHistory,true);assert.equal(h.calls[0].options.width,520);assert.deepEqual(h.calls[0].event.eventPanel.classes,['civil-history-event']);assert.equal(JSON.stringify(s),before);assert.equal(history.open(s),false);assert.equal(h.calls.length,1);
});
test('lower-right menu is progressive mounts once supports keyboard and follows the current imported state',()=>{
  const h=harness(),{history,ctx,s}=h,elements=dom(h),early={civilization:{elapsed:0,settled:false,tech:{},society:{history:[]},pending:null}};
  ctx.State=early;assert.equal(history.refresh(early),false);assert.equal(elements.has('#historyMenu'),false);assert.equal(history.open(early),false);assert.equal(h.calls.length,0);
  early.civilization.tech.handtools=true;assert.equal(history.refresh(early),true);const button=elements.get('#historyMenu');assert.equal(button.parent,elements.get('.menu'));assert.equal(button.value,'发展史');assert.equal(button.attributes.role,'button');history.refresh(early);assert.equal(elements.get('#historyMenu'),button);
  ctx.State=s;s.civilization.pending='succession';history.refresh(s);assert.equal(button.attributes['aria-disabled'],'true');button.handlers.click();assert.equal(h.calls.length,0);s.civilization.pending=null;history.refresh(s);assert.equal(button.attributes['aria-disabled'],'false');
  const before=JSON.stringify(s);let prevented=false;button.handlers.keydown({key:'Enter',preventDefault(){prevented=true;}});assert.equal(prevented,true);assert.equal(h.calls.length,1);assert.match(h.calls[0].event.scenes.start.text[0],new RegExp('重建 '+Math.floor(s.civilization.elapsed/600)+' 年'));assert.equal(JSON.stringify(s),before);
  history.reset();assert.equal(elements.has('#historyMenu'),false);assert.equal(h.ctx.Events.activeEvent().civilHistory,true,'reset does not close or replace the active event');
});
test('untrusted text remains native story text and invented history is never an economic or achievement authority',()=>{
  const {s,ctx,history}=harness();ctx.CivilText.research.steel.name='<img src=x onerror=evil()>';s.civilization.history={entries:[{type:'technology',id:'free_technology',at:0}]};
  const before=JSON.stringify(s),event=history.event(s),text=Object.values(event.scenes).flatMap(scene=>scene.text).join('\n');assert.ok(text.includes('<img src=x onerror=evil()>'));assert.ok(!text.includes('free_technology'));assert.equal(JSON.stringify(s),before);assert.equal(s.civilization.tech.free_technology,undefined);
  const native=fs.readFileSync(path.join(root,'script/events.js'),'utf8');assert.match(native,/\$\('<div>'\)\.text\(scene\.text\[i\]\)/,'all history strings are escaped by native Events.startStory');
});

test('history scene transitions reset the text scroll position without modifying any saved state',()=>{
 const {ctx,s,history}=harness(),before=JSON.stringify(s),scrolls=[];
 ctx.Events.eventPanel=()=>({id:'event'});ctx.$=(selector,panel)=>{assert.equal(selector,'#description');assert.equal(panel.id,'event');return {scrollTop(n){scrolls.push(n);}};};
 const event=history.event(s);for(const scene of Object.values(event.scenes))scene.onLoad();assert.ok(scrolls.length>1);assert.ok(scrolls.every(n=>n===0));assert.equal(JSON.stringify(s),before);
});

test('common agreements and exits use their actual transaction dates without presenting promised deliveries as completed history',()=>{
 const {s,history}=harness(),at=s.civilization.elapsed;s.civilization.finance={agreements:[{id:1,members:['home','river','rail'],approvals:{home:30,river:10,rail:10},approvedAt:at-100,exitedAt:at-20}]};const before=JSON.stringify(s);
 const view=history.snapshot(s),records=view.entries.filter(e=>e.category==='budgets');assert.equal(records.length,2);assert.equal(records[0].at,at-100);assert.equal(records[1].at,at-20);assert.match(records[0].detail,/30知识/);assert.ok(!records[0].detail.includes('已送达'));assert.equal(JSON.stringify(s),before);
});
