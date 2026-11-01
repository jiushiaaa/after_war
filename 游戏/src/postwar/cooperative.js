/* MPL-2.0 — One worker-owned local workshop, separate goods and paid in-kind contracts. */
CivilMunicipalContent.jobs.push('coopsmith');
CivilText.labels.coopsmith='合作制器工';
var CivilCooperative={
  pendingIds:['cooperative_river','cooperative_rail','cooperative_highland','cooperative_ford'],
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
  contracted(s,id){return this.data(s,id)?.standing?.controls.at(-1)?.enabled===true;},
  setContract(s,id,value){
    const d=this.data(s,id);if(!d||typeof value!=='boolean'||value===this.contracted(s,id))return false;
    if(!d.standing)d.standing={controls:[],lastAt:null};
    d.standing.controls.push({at:s.civilization.elapsed,enabled:value});CivilMunicipal.planWorkers(s,id);return true;
  },
  contractRunning(s,id){return this.contracted(s,id)&&this.enabled(s,id)&&CivilMunicipal.canAccept(s,id);},
  contractReserve(s,id,seconds){const batches=Math.ceil(seconds/30);return this.contractRunning(s,id)?{food:6*batches,wood:4*batches,scrap:12*batches}:{};},
  standingTrade(s,id){
    const d=this.data(s,id),p=d?.standing,at=s.civilization.elapsed;if(!p||!this.contractRunning(s,id))return;
    if(at-Math.max(p.lastAt??0,p.controls.at(-1).at)<30)return;
    p.lastAt=at;const control=p.controls.length;
    // Each check may settle at most one batch in each direction, never a backlog.
    if(d.stores.food<12&&d.stores.tools>=2)this.trade(s,id,'tools',control);
    if(d.stores.wood<.8-1e-8||d.stores.scrap<2.4-1e-8){
      const n=CivilMunicipal.node(s,id),inputs=CivilMunicipal.data(s,id).economy?.paidInputs?.resources||{};
      if(n.stores.wood>=4+(inputs.wood||0)*6&&n.stores.scrap>=12+(inputs.scrap||0)*6)this.trade(s,id,'materials',control);
    }
  },
  productionReady(s,id){const d=this.data(s,id);return !!d&&this.enabled(s,id)&&CivilMunicipal.canAccept(s,id)&&d.stores.wood>=.2-1e-8&&d.stores.scrap>=.6-1e-8&&d.stores.food>=.1-1e-8;},
  settle(s,id,factor){
    const d=this.data(s,id),at=s.civilization.elapsed;if(!d||d.last?.at===at)return {meal:0};
    let workers=this.productionReady(s,id)?Math.min(4,CivilMunicipal.node(s,id).workers.coopsmith||0):0;
    for(const [key,cost]of Object.entries({wood:.2,scrap:.6,food:.1}))workers=Math.min(workers,Math.floor((d.stores[key]+1e-8)/cost));
    CivilMunicipal.pay(d.stores,{wood:workers*.2,scrap:workers*.6,food:workers*.1});
    const tools=workers*.25*factor;d.stores.tools+=tools;d.totals.batches+=workers;d.totals.tools+=tools;
    d.last={at,workers,factor,tools,meal:workers*.1};return {meal:d.last.meal};
  },
  trade(s,id,kind,standing){
    const d=this.data(s,id),n=CivilMunicipal.node(s,id);if(!d||!CivilMunicipal.canAccept(s,id)||!['tools','materials'].includes(kind))return false;
    const publicOut=kind==='tools'?{food:6}:{wood:4,scrap:12},privateOut=kind==='tools'?{tools:2}:{food:6};
    if(kind==='tools'&&(n.stores.food||0)<CivilMunicipal.foodReserve(s,id)+6)return false;
    if(Object.entries(publicOut).some(([k,v])=>(n.stores[k]||0)+1e-8<v)||Object.entries(privateOut).some(([k,v])=>(d.stores[k]||0)+1e-8<v))return false;
    CivilMunicipal.pay(n.stores,publicOut);CivilMunicipal.pay(d.stores,privateOut);
    for(const [k,v]of Object.entries(publicOut))d.stores[k]+=v;
    for(const [k,v]of Object.entries(privateOut))n.stores[k]=(n.stores[k]||0)+v;
    d.trades.push({id:d.trades.length+1,at:s.civilization.elapsed,kind,...(standing===undefined?{}:{standing})});CivilMunicipal.planWorkers(s,id);return true;
  },
  status(s,id){
    const d=this.data(s,id);if(!d)return '地方制器间仍由公共仓经营';
    const fmt=n=>Number(n.toFixed(2)),st=d.stores;
    return '合作社所有：1处地方制器间。社仓 木'+fmt(st.wood)+'、废料'+fmt(st.scrap)+'、食物'+fmt(st.food)+'、工具'+fmt(st.tools)+'。'+(!this.enabled(s,id)?'生产已暂停，资产与社仓保留。':!this.productionReady(s,id)?'原料或实物报酬不足，等待交换。':'实际合作制器工 '+(CivilMunicipal.node(s,id).workers.coopsmith||0)+' / 4。')+(d.last?'近轮产工具'+fmt(d.last.tools)+'，实付工作餐'+fmt(d.last.meal)+'；同额抵扣公共口粮，不重复吃两份。':'');
  },
  summary(s,id){
    const d=this.data(s,id);if(!d)return null;const fmt=n=>Number(n.toFixed(2));
    return {title:'制器合作社 · 独立社仓',cards:[['木料',fmt(d.stores.wood)],['废料',fmt(d.stores.scrap)],['食物',fmt(d.stores.food)],['工具',fmt(d.stores.tools)],['实际在岗',(CivilMunicipal.node(s,id).workers.coopsmith||0)+' / 4'],['近轮工具',fmt(d.last?.tools||0)]],
      brief:this.contracted(s,id)?'持续合同已开启 · 每30秒核对；停工时停止自动交易':null,notices:!this.enabled(s,id)?['生产已暂停；社仓与所有权保留']:!this.productionReady(s,id)?['原料或工作餐不足，等待交换']:[],
      details:[['所有权','合作社拥有1处已建制器间，产出归社仓'],['工作餐','近轮实付食物 '+fmt(d.last?.meal||0)+'，抵扣同额公共口粮'],['生产用料','每人每10秒：木0.2、废料0.6、食物0.1；产工具0.25，受当地生产状况影响'],['公库采购','支付食物6，收取工具2；保留120秒公共口粮'],['社仓进料','支付食物6，收取木4、废料12'],['已成交',d.trades.length+' 批']]};
  },
  event(eventId){
    const match=/^cooperative_(river|rail|highland|ford)$/.exec(eventId);if(!match)return null;
    const s=State,id=match[1],d=this.data(s,id);if(!d&&!this.eligible(s,id))return null;
    const signature=()=>JSON.stringify([!!this.data(s,id),this.data(s,id)?.controls.length||0,this.data(s,id)?.trades.filter(t=>t.standing===undefined).length||0,this.data(s,id)?.standing?.controls.length||0]),expected=signature();
    const action=fn=>()=>{if(s.civilization.pending!==eventId||signature()!==expected||!fn())return false;s.civilization.pending=null;Civilization.refresh();Engine.saveGame();return true;};
    const buttons=d?{trade:{text:'公库购入2工具',nextScene:'end',onChoose:action(()=>this.trade(s,id,'tools'))},materials:{text:'社仓购入原料',nextScene:'end',onChoose:action(()=>this.trade(s,id,'materials'))},schedule:{text:this.enabled(s,id)?'暂停合作生产':'恢复合作生产',nextScene:'end',onChoose:action(()=>this.setEnabled(s,id,!this.enabled(s,id)))}}:{agree:{text:'设立合作作坊',nextScene:'end',onChoose:action(()=>this.found(s,id))}};
    if(d)buttons.contract={text:this.contracted(s,id)?'暂停持续合同':'开启持续合同',nextScene:'end',onChoose:action(()=>this.setContract(s,id,!this.contracted(s,id)))};
    buttons.close={text:d?'关闭':'保留公共经营',nextScene:'end',onChoose:()=>{if(s.civilization.pending===eventId)s.civilization.pending=null;}};
    return {title:CivilRegionContent[id].name+'的制器合作社',text:d?[
      this.status(s,id),
      '公库采购：6食物换2工具，先保留120秒公共口粮。社仓进料：6食物换木4、废料12。双方须有实物，每次成交一批。',
      '持续合同每30秒核对：社粮不足12时购入一批工具；原料不足4人开工时供给一批原料。双方仍须实际付款，并保留公共口粮和60秒现有生产用木、废料。不追补错过的批次。',
      '暂停合同仅停止自动交易；暂停生产也停止自动交易，社仓与所有权保留。'
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
    const model=this.summary(s,id);if(model&&typeof CivilInterface!=='undefined')CivilInterface.summary('#civilCooperativeStatus',model);else box.text(this.status(s,id));box.toggle(visible);b.insertAfter(box);
  },
  validate(s){
    const v=s.civilization.cooperative;if(v===undefined)return;
    const obj=x=>!!x&&typeof x==='object'&&!Array.isArray(x),exact=(x,keys)=>obj(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
    const int=(x,max=s.civilization.elapsed)=>Number.isSafeInteger(x)&&x>=0&&x<=max,num=x=>Number.isFinite(x)&&x>=0&&x<=1e12,near=(a,b)=>Math.abs(a-b)<1e-6,fail=()=>{throw Error('合作作坊资产与实物账无效');};
    if(!exact(v,['schema','nodes'])||v.schema!==1||!obj(v.nodes))fail();
    for(const [id,d]of Object.entries(v.nodes)){
      const m=CivilMunicipal.data(s,id),asset=m?.completed.find(p=>p.id===d?.assetProjectId);
      if(!Object.hasOwn(CivilRegionContent,id)||!m?.city||!asset||asset.type!=='toolworks'||!m.buildings.toolworks||!exact(d,['foundedAt','generation','assetProjectId','stores','controls','trades','totals','last',...(d.standing===undefined?[]:['standing'])])||!int(d.foundedAt)||d.foundedAt<asset.completedAt||!int(d.generation,s.civilization.society.generation)||d.generation<1||!exact(d.stores,Object.keys(this.grant))||Object.values(d.stores).some(x=>!num(x))||!Array.isArray(d.controls)||!Array.isArray(d.trades)||!exact(d.totals,['batches','tools'])||!int(d.totals.batches,1e10)||!num(d.totals.tools)||d.totals.tools>d.totals.batches*.25+1e-6)fail();
      const term=d.generation===s.civilization.society.generation?{from:s.civilization.society.leader.started,to:Math.floor(s.civilization.elapsed/600)}:s.civilization.society.history[d.generation-1];if(!term||Math.floor(d.foundedAt/600)<term.from||Math.floor(d.foundedAt/600)>term.to)fail();
      let at=d.foundedAt,enabled=true;for(const x of d.controls){if(!exact(x,['at','enabled'])||!int(x.at)||x.at<at||typeof x.enabled!=='boolean'||x.enabled===enabled)fail();enabled=x.enabled;at=x.at;}
      if(d.standing!==undefined){
        const p=d.standing;if(!exact(p,['controls','lastAt'])||!Array.isArray(p.controls)||!p.controls.length)fail();
        let prev=d.foundedAt,on=false;for(const x of p.controls){if(!exact(x,['at','enabled'])||!int(x.at)||x.at<prev||typeof x.enabled!=='boolean'||x.enabled===on)fail();prev=x.at;on=x.enabled;}
        if(p.lastAt!==null&&(!int(p.lastAt)||!p.controls.some((x,i)=>x.enabled&&p.lastAt>=x.at+30&&(!p.controls[i+1]||p.lastAt<=p.controls[i+1].at))))fail();
      }
      const expected={...this.grant};at=d.foundedAt;
      const automatic=new Map();
      for(const [index,x]of d.trades.entries()){
        if(!exact(x,['id','at','kind',...(x.standing===undefined?[]:['standing'])])||x.id!==index+1||!int(x.at)||x.at<at||!['tools','materials'].includes(x.kind))fail();at=x.at;
        if(x.standing!==undefined){
          const p=d.standing,control=p?.controls[x.standing-1],next=p?.controls[x.standing];
          const work=[{at:d.foundedAt,enabled:true},...d.controls];
          if(!int(x.standing,p?.controls.length||0)||!control?.enabled||x.at<control.at+30||next&&x.at>next.at||x.at>(p.lastAt??-1)||!work.some((t,i)=>t.enabled&&t.at<=x.at&&(!work[i+1]||x.at<=work[i+1].at)))fail();
          const prev=automatic.get(x.kind);if(prev!==undefined&&x.at-prev<30)fail();automatic.set(x.kind,x.at);
        }
        if(x.kind==='tools'){expected.tools-=2;expected.food+=6;}else{expected.wood+=4;expected.scrap+=12;expected.food-=6;}
      }
      expected.wood-=d.totals.batches*.2;expected.scrap-=d.totals.batches*.6;expected.food-=d.totals.batches*.1;expected.tools+=d.totals.tools;
      if(Object.keys(expected).some(k=>!near(expected[k],d.stores[k])))fail();
      const r=d.last;if(r===null){if(d.totals.batches!==0||d.totals.tools!==0)fail();}
      else if(!exact(r,['at','workers','factor','tools','meal'])||!int(r.at)||r.at<d.foundedAt||!int(r.workers,4)||!num(r.factor)||r.factor>1||!num(r.tools)||!num(r.meal)||!near(r.tools,r.workers*.25*r.factor)||!near(r.meal,r.workers*.1)||r.workers>d.totals.batches||r.tools>d.totals.tools+1e-6||d.totals.batches>4*(Math.floor((r.at-d.foundedAt)/10)+1))fail();
    }
  }
};
