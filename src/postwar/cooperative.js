/* MPL-2.0 — One worker-owned local workshop, separate goods and paid in-kind contracts. */
CivilMunicipalContent.jobs.push('coopsmith');
CivilText.labels.coopsmith='合作制器工';
var CivilCooperative={
  pendingIds:['cooperative_river','cooperative_rail','cooperative_highland'],
  grant:{wood:20,scrap:60,food:24,tools:0},
  data(s,id){return s.civilization.cooperative?.nodes[id];},
  eligible(s,id){const m=CivilMunicipal.data(s,id),n=CivilMunicipal.node(s,id);return !!(m?.city&&m.buildings.toolworks&&CivilMunicipal.canAccept(s,id)&&n.health>=60&&s.civilization.tech.records&&s.civilization.tech.administration);},
  found(s,id){
    if(this.data(s,id)||!this.eligible(s,id))return false;
    const c=s.civilization,n=CivilMunicipal.node(s,id),m=CivilMunicipal.data(s,id),asset=m.completed.find(p=>p.type==='toolworks');
    if(!asset||n.stores.food<CivilMunicipal.foodReserve(s,id)+this.grant.food||!CivilMunicipal.pay(n.stores,{...this.grant,knowledge:20}))return false;
    if(c.cooperative===undefined)c.cooperative={schema:1,nodes:{}};
    c.cooperative.nodes[id]={foundedAt:c.elapsed,generation:c.society.generation,assetProjectId:asset.id,stores:{...this.grant},controls:[],trades:[],totals:{batches:0,tools:0},last:null};
    CivilMunicipal.planWorkers(s,id);return true;
  },
  enabled(s,id){return this.data(s,id)?.controls.at(-1)?.enabled??true;},
  setEnabled(s,id,value){const d=this.data(s,id);if(!d||typeof value!=='boolean'||value===this.enabled(s,id))return false;d.controls.push({at:s.civilization.elapsed,enabled:value});CivilMunicipal.planWorkers(s,id);return true;},
  productionReady(s,id){const d=this.data(s,id);return !!d&&this.enabled(s,id)&&CivilMunicipal.canAccept(s,id)&&d.stores.wood>=.2-1e-8&&d.stores.scrap>=.6-1e-8&&d.stores.food>=.1-1e-8;},
  settle(s,id,factor){
    const d=this.data(s,id),at=s.civilization.elapsed;if(!d||d.last?.at===at)return {meal:0};
    let workers=this.productionReady(s,id)?Math.min(4,CivilMunicipal.node(s,id).workers.coopsmith||0):0;
    for(const [key,cost]of Object.entries({wood:.2,scrap:.6,food:.1}))workers=Math.min(workers,Math.floor((d.stores[key]+1e-8)/cost));
    CivilMunicipal.pay(d.stores,{wood:workers*.2,scrap:workers*.6,food:workers*.1});
    const tools=workers*.25*factor;d.stores.tools+=tools;d.totals.batches+=workers;d.totals.tools+=tools;
    d.last={at,workers,factor,tools,meal:workers*.1};return {meal:d.last.meal};
  },
  trade(s,id,kind){
    const d=this.data(s,id),n=CivilMunicipal.node(s,id);if(!d||!CivilMunicipal.canAccept(s,id)||!['tools','materials'].includes(kind))return false;
    const publicOut=kind==='tools'?{food:6}:{wood:4,scrap:12},privateOut=kind==='tools'?{tools:2}:{food:6};
    if(kind==='tools'&&(n.stores.food||0)<CivilMunicipal.foodReserve(s,id)+6)return false;
    if(Object.entries(publicOut).some(([k,v])=>(n.stores[k]||0)+1e-8<v)||Object.entries(privateOut).some(([k,v])=>(d.stores[k]||0)+1e-8<v))return false;
    CivilMunicipal.pay(n.stores,publicOut);CivilMunicipal.pay(d.stores,privateOut);
    for(const [k,v]of Object.entries(publicOut))d.stores[k]+=v;
    for(const [k,v]of Object.entries(privateOut))n.stores[k]=(n.stores[k]||0)+v;
    d.trades.push({id:d.trades.length+1,at:s.civilization.elapsed,kind});CivilMunicipal.planWorkers(s,id);return true;
  },
  status(s,id){
    const d=this.data(s,id);if(!d)return '地方制器间仍由公共仓经营';
    const fmt=n=>Number(n.toFixed(2)),st=d.stores;
    return '合作社所有：1处地方制器间。社仓 木'+fmt(st.wood)+'、废料'+fmt(st.scrap)+'、食物'+fmt(st.food)+'、工具'+fmt(st.tools)+'。'+(!this.enabled(s,id)?'生产已暂停，资产与社仓保留。':!this.productionReady(s,id)?'原料或实物报酬不足，等待交换。':'实际合作制器工 '+(CivilMunicipal.node(s,id).workers.coopsmith||0)+' / 4。')+(d.last?'近轮产工具'+fmt(d.last.tools)+'，实付工作餐'+fmt(d.last.meal)+'；同额抵扣公共口粮，不重复吃两份。':'');
  },
  summary(s,id){
    const d=this.data(s,id);if(!d)return null;const fmt=n=>Number(n.toFixed(2));
    return {title:'制器合作社 · 独立社仓',cards:[['木料',fmt(d.stores.wood)],['废料',fmt(d.stores.scrap)],['食物',fmt(d.stores.food)],['工具',fmt(d.stores.tools)],['实际在岗',(CivilMunicipal.node(s,id).workers.coopsmith||0)+' / 4'],['近轮工具',fmt(d.last?.tools||0)]],
      brief:null,notices:!this.enabled(s,id)?['生产已暂停；社仓与所有权保留']:!this.productionReady(s,id)?['原料或工作餐不足，等待交换']:[],
      details:[['所有权','合作社拥有1处已建制器间，产出归社仓'],['工作餐','近轮实付食物 '+fmt(d.last?.meal||0)+'，抵扣同额公共口粮'],['生产用料','每人每10秒：木0.2、废料0.6、食物0.1；产工具0.25，受当地生产状况影响'],['公库采购','支付食物6，收取工具2；保留120秒公共口粮'],['社仓进料','支付食物6，收取木4、废料12'],['已成交',d.trades.length+' 批']]};
  },
  event(eventId){
    const match=/^cooperative_(river|rail|highland)$/.exec(eventId);if(!match)return null;
    const s=State,id=match[1],d=this.data(s,id);if(!d&&!this.eligible(s,id))return null;
    const signature=()=>JSON.stringify([!!this.data(s,id),this.data(s,id)?.controls.length||0,this.data(s,id)?.trades.length||0]),expected=signature();
    const action=fn=>()=>{if(s.civilization.pending!==eventId||signature()!==expected||!fn())return false;s.civilization.pending=null;Civilization.refresh();Engine.saveGame();return true;};
    const buttons=d?{trade:{text:'公库购入2工具',nextScene:'end',onChoose:action(()=>this.trade(s,id,'tools'))},materials:{text:'社仓购入原料',nextScene:'end',onChoose:action(()=>this.trade(s,id,'materials'))},schedule:{text:this.enabled(s,id)?'暂停合作生产':'恢复合作生产',nextScene:'end',onChoose:action(()=>this.setEnabled(s,id,!this.enabled(s,id)))}}:{agree:{text:'设立合作作坊',nextScene:'end',onChoose:action(()=>this.found(s,id))}};
    buttons.close={text:d?'关闭':'保留公共经营',nextScene:'end',onChoose:()=>{if(s.civilization.pending===eventId)s.civilization.pending=null;}};
    return {title:CivilRegionContent[id].name+'的制器合作社',text:d?[
      this.status(s,id),
      '公库采购：6食物换2工具，先保留120秒公共口粮。社仓进料：6食物换木4、废料12。双方须有实物，每次成交一批。',
      '暂停只撤回生产岗位，社仓与所有权保留。'
    ]:[
      '制器工提出共同拥有一处已建制器间，由在岗劳动者参与经营。其余设施、公共医护与基本配给继续由地方负责；保留公共经营也可继续发展。',
      '设立时地方实付20知识办理契约，并将一处制器间及木20、废料60、食物24转给合作社。这是公开的创办投入；不新增建筑或人口，也不直接退款收回资产。',
      '原公共制器岗位减少4个，同一批现有劳力可在合作作坊工作。每位每10秒从社仓消耗木0.2、废料0.6，产工具0.25乘当地生产系数；另实付0.1食物工作餐，抵扣该轮同额公共口粮。原料、工具和报酬均属于独立社仓，不能同时再给公库产一份。',
      '公库购入：付6食物，取得社仓2工具，先保护120秒公共口粮。社仓购入原料：付6食物，向本地公库取得木4、废料12。双方都须有实物；每次只成交一批，无凭空补货、税款或借贷。',
      this.status(s,id)
    ],buttons};
  },
  refresh(s,id){
    const visible=!!this.data(s,id)||this.eligible(s,id);let b=$('#cooperativeButton');
    if(visible)b=Civilization.button('cooperativeButton','作坊所有权','#municipalBuild',()=>{const target=CivilMunicipal.selected;if(!Events.activeEvent()&&!State.civilization.pending&&(this.data(State,target)||this.eligible(State,target))){State.civilization.pending='cooperative_'+target;Civilization.showPending();}});
    b.toggle(visible);let box=$('#civilCooperativeStatus');if(!box.length)box=$('<div>').attr('id','civilCooperativeStatus').insertAfter('#municipalStatus');
    const model=this.summary(s,id);if(model&&typeof CivilInterface!=='undefined')CivilInterface.summary('#civilCooperativeStatus',model);else box.text(this.status(s,id));box.toggle(visible);
  },
  validate(s){
    const v=s.civilization.cooperative;if(v===undefined)return;
    const obj=x=>!!x&&typeof x==='object'&&!Array.isArray(x),exact=(x,keys)=>obj(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
    const int=(x,max=s.civilization.elapsed)=>Number.isSafeInteger(x)&&x>=0&&x<=max,num=x=>Number.isFinite(x)&&x>=0&&x<=1e12,near=(a,b)=>Math.abs(a-b)<1e-6,fail=()=>{throw Error('合作作坊资产与实物账无效');};
    if(!exact(v,['schema','nodes'])||v.schema!==1||!obj(v.nodes))fail();
    for(const [id,d]of Object.entries(v.nodes)){
      const m=CivilMunicipal.data(s,id),asset=m?.completed.find(p=>p.id===d?.assetProjectId);
      if(!Object.hasOwn(CivilRegionContent,id)||!m?.city||!asset||asset.type!=='toolworks'||!m.buildings.toolworks||!exact(d,['foundedAt','generation','assetProjectId','stores','controls','trades','totals','last'])||!int(d.foundedAt)||d.foundedAt<asset.completedAt||!int(d.generation,s.civilization.society.generation)||d.generation<1||!exact(d.stores,Object.keys(this.grant))||Object.values(d.stores).some(x=>!num(x))||!Array.isArray(d.controls)||!Array.isArray(d.trades)||!exact(d.totals,['batches','tools'])||!int(d.totals.batches,1e10)||!num(d.totals.tools)||d.totals.tools>d.totals.batches*.25+1e-6)fail();
      const term=d.generation===s.civilization.society.generation?{from:s.civilization.society.leader.started,to:Math.floor(s.civilization.elapsed/600)}:s.civilization.society.history[d.generation-1];if(!term||Math.floor(d.foundedAt/600)<term.from||Math.floor(d.foundedAt/600)>term.to)fail();
      let at=d.foundedAt,enabled=true;for(const x of d.controls){if(!exact(x,['at','enabled'])||!int(x.at)||x.at<at||typeof x.enabled!=='boolean'||x.enabled===enabled)fail();enabled=x.enabled;at=x.at;}
      const expected={...this.grant};at=d.foundedAt;
      for(const [index,x]of d.trades.entries()){
        if(!exact(x,['id','at','kind'])||x.id!==index+1||!int(x.at)||x.at<at||!['tools','materials'].includes(x.kind))fail();at=x.at;
        if(x.kind==='tools'){expected.tools-=2;expected.food+=6;}else{expected.wood+=4;expected.scrap+=12;expected.food-=6;}
      }
      expected.wood-=d.totals.batches*.2;expected.scrap-=d.totals.batches*.6;expected.food-=d.totals.batches*.1;expected.tools+=d.totals.tools;
      if(Object.keys(expected).some(k=>!near(expected[k],d.stores[k])))fail();
      const r=d.last;if(r===null){if(d.totals.batches!==0||d.totals.tools!==0)fail();}
      else if(!exact(r,['at','workers','factor','tools','meal'])||!int(r.at)||r.at<d.foundedAt||!int(r.workers,4)||!num(r.factor)||r.factor>1||!num(r.tools)||!num(r.meal)||!near(r.tools,r.workers*.25*r.factor)||!near(r.meal,r.workers*.1)||r.workers>d.totals.batches||r.tools>d.totals.tools+1e-6||d.totals.batches>4*(Math.floor((r.at-d.foundedAt)/10)+1))fail();
    }
  }
};
