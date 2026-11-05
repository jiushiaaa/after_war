/* MPL-2.0 — 战后文明: near-field exploration (schema 1).
   Reuses the ADR world idea (ASCII tiles, fog, backpack) without World/Path state,
   the original starship or ending. Party members are real residents taken out of
   the home workforce; supplies leave the shared stores once and return once. */
var CivilExpedition={
  C:()=>CivilExpeditionContent,
  prep:{members:1,food:4,water:6,kit:false,armed:false},
  data(s){return s.civilization.expedition||null;},
  unlocked(s){return !!s.game.buildings.workshop;},
  legacyJourney(s){return ['station','pump','salvage'].includes(s.civilization.journey?.id)||['station','pump','salvage'].includes(s.civilization.pending);},
  canDepartStage(s){return !s.civilization.urban?.city;},
  tile(x,y){const C=this.C();return x<0||y<0||x>=C.size||y>=C.size?null:C.rows[y][x];},
  terrain(x,y){const t=this.tile(x,y);return t===null?null:this.C().terrain[t];},
  rng(seed){let v=seed>>>0||1;return ()=>{v=(Math.imul(v,1664525)+1013904223)>>>0;return v/4294967296;};},
  // Read-only view of the field for saves that never opened it; nothing is written.
  view(s){return this.data(s)||this.fresh(s,0);},
  fresh(s,seed){
    const C=this.C(),c=s.civilization,known=Array(C.size).fill(0);
    const d={schema:1,seed,createdAt:c.elapsed,known,sites:{station:{state:c.station?'recovered':'new',stock:c.station?40:0},pump:{state:c.pump?'repaired':'new'},ruin:{state:'new',stock:14},cellar:{state:'new'}},
      caches:[],beetles:'unknown',party:null,resting:null,survivors:null,trips:0,records:[]};
    const r=this.rng(seed),spots=C.cacheSpots.map(p=>[...p]);
    for(let i=0;i<C.caches.length&&spots.length;i++){const p=spots.splice(Math.floor(r()*spots.length),1)[0];d.caches.push({x:p[0],y:p[1],goods:{...C.caches[i]},taken:false});}
    this.reveal(d,...C.home,C.lightRadius);
    if(c.station){for(let x=12;x<=23;x++)this.reveal(d,x,12,1);for(let y=4;y<=12;y++)this.reveal(d,17,y,1);for(let x=17;x<=23;x++)this.reveal(d,x,4,1);}
    if(c.pump)this.reveal(d,4,19,C.lightRadius);
    return d;
  },
  ensure(s){
    const c=s.civilization;if(c.expedition)return c.expedition;
    c.expedition=this.fresh(s,1+Math.floor(Math.random()*2147483646));return c.expedition;
  },
  reveal(d,cx,cy,r){
    const C=this.C();
    for(let y=cy-r;y<=cy+r;y++)for(let x=cx-r;x<=cx+r;x++){
      if(x<0||y<0||x>=C.size||y>=C.size||Math.abs(x-cx)+Math.abs(y-cy)>r+1)continue;
      d.known[y]|=1<<x;
    }
  },
  isKnown(d,x,y){return !!(d.known[y]&(1<<x));},
  siteAt(x,y){return this.C().sites[this.tile(x,y)]||null;},
  record(s,kind,title,detail){const d=this.data(s);d.records.push({at:s.civilization.elapsed,kind,title,detail});},
  weight(pack){const w=this.C().weight;return Object.entries(pack).reduce((n,[k,v])=>n+(w[k]||1)*v,0);},
  capacity(s,members){const C=this.C();return members*C.capacity.member+((s.game.buildings.cart||0)>0?C.capacity.cart:0);},
  waterWood(s){return s.game.buildings.cistern?.1:.5;},
  // Party members and recovering residents are not available for home jobs.
  unavailable(s){
    const d=s.civilization?.expedition;if(!d)return 0;
    return (d.party?.members||0)+(d.resting&&d.resting.until>s.civilization.elapsed?d.resting.count:0);
  },
  // Residents in the field eat from the pack, not from home rations.
  awayEaters(s){return s.civilization?.expedition?.party?.members||0;},
  freeHands(s){return typeof Outside!=='undefined'&&Outside.getNumGatherers?Outside.getNumGatherers():0;},
  departCost(s,p){
    const kit=p.kit?this.C().repairKit:{},cost={...(p.armed&&(typeof CivilEquipment!=='undefined'&&CivilEquipment.enabled(s))?{ammunition:4}:{}),food:p.food,wood:Math.round((p.water*this.waterWood(s)+(kit.wood||0))*100)/100};
    if(kit.scrap)cost.scrap=kit.scrap;for(const k of Object.keys(cost))if(!cost[k])delete cost[k];return cost;
  },
  departReason(s,p=this.prep){
    const C=this.C(),d=this.data(s);
    if(typeof CivilClock!=='undefined'&&CivilClock.paused)return '世界已暂停，恢复时间后出发';
    if(!this.unlocked(s))return '需要工坊';
    if(!this.canDepartStage(s))return '城市阶段由巡护制度照看近郊';
    if(d?.party)return '小队仍在外面';
    if(this.legacyJourney(s))return '先处理旧公路上的行程';
    if(!Number.isInteger(p.members)||p.members<1||p.members>C.maxMembers)return '小队人数无效';
    if(this.freeHands(s)<p.members)return '需要 '+p.members+' 名空闲居民（采木工），现有 '+Math.max(0,this.freeHands(s));
    const pack={food:p.food,water:p.water,...(p.kit?C.repairKit:{}),...(p.armed&&(typeof CivilEquipment!=='undefined'&&CivilEquipment.enabled(s))?{ammunition:4}:{})};
    if(p.armed&&(typeof CivilEquipment!=='undefined'&&CivilEquipment.enabled(s))&&!s.civilization.fieldEquipment?.gun)return '先修复猎枪';
    if(this.weight(pack)>this.capacity(s,p.members)+1e-9)return '超出背负上限';
    if(p.food<=0||p.water<=0)return '至少带上口粮和饮水';
    if(!CivilRules.canPay(s,this.departCost(s,p)))return '库存不足';
    return null;
  },
  depart(s,p=this.prep){
    if(this.departReason(s,p))return false;
    const C=this.C(),cost=this.departCost(s,p);
    if(!CivilRules.pay(s,cost))return false;
    const d=this.ensure(s);
    d.party={members:p.members,pos:[...C.home],prev:[...C.home],pack:{food:p.food,water:p.water,...(p.kit?{...C.repairKit}:{})},...(p.armed&&(typeof CivilEquipment!=='undefined'&&CivilEquipment.enabled(s))?{noise:0}:{}),cap:this.capacity(s,p.members),steps:0,departedAt:s.civilization.elapsed,hurt:0,starving:0,encounter:null,smoke:false,paid:cost};
    if(p.armed&&(typeof CivilEquipment!=='undefined'&&CivilEquipment.enabled(s)))d.party.pack.ammunition=4;
    d.trips++;
    if(typeof CivilSociety!=='undefined')CivilSociety.trimJobs(s);
    return true;
  },
  free(party){return Math.max(0,party.cap-this.weight(party.pack));},
  load(party,key,n){
    const w=this.C().weight[key]||1,take=Math.max(0,Math.min(n,Math.floor(this.free(party)/w*100+1e-9)/100));
    if(take>0)party.pack[key]=Math.round(((party.pack[key]||0)+take)*100)/100;return take;
  },
  consume(party,steps=1){
    const C=this.C(),food=party.members*C.member.food*steps,water=party.members*C.member.water*steps;
    const short=(party.pack.food||0)+1e-9<food||(party.pack.water||0)+1e-9<water;
    party.pack.food=Math.max(0,Math.round(((party.pack.food||0)-food)*1000)/1000);
    party.pack.water=Math.max(0,Math.round(((party.pack.water||0)-water)*1000)/1000);
    party.starving=short?party.starving+1:0;
    return short;
  },
  moveReason(s,dx,dy){
    const d=this.data(s),p=d?.party;
    if(typeof CivilClock!=='undefined'&&CivilClock.paused)return '世界已暂停，恢复时间后行进';
    if(!p)return '小队不在外面';
    if(p.encounter)return '先处理眼前的情况';
    if(typeof Events!=='undefined'&&Events.activeEvent?.())return '先处理眼前的事件';
    const x=p.pos[0]+dx,y=p.pos[1]+dy,t=this.terrain(x,y);
    if(!t)return '已到近郊边界';
    if(!t.pass)return t.name+'无法通行';
    return null;
  },
  move(s,dx,dy){
    if(this.moveReason(s,dx,dy))return false;
    const C=this.C(),d=this.data(s),p=d.party;
    p.prev=[...p.pos];p.pos=[p.pos[0]+dx,p.pos[1]+dy];p.steps++;
    this.reveal(d,p.pos[0],p.pos[1],C.lightRadius);
    const short=this.consume(p);
    if(short&&p.starving>=3){this.collapse(s);return 'collapse';}
    const [x,y]=p.pos,t=this.terrain(x,y);
    if(this.tile(x,y)==='A'){this.arrive(s);return 'home';}
    if((typeof CivilEquipment!=='undefined'&&CivilEquipment.enabled(s))&&p.noise>0){p.noise--;if(p.noise===3){p.encounter='beetle';return 'encounter';}}
    if(t.danger&&d.beetles!=='observed'&&!p.smoke){p.encounter='beetle';if(d.beetles==='unknown')d.beetles='seen';return 'encounter';}
    const cache=d.caches.find(k=>!k.taken&&k.x===x&&k.y===y);
    if(cache){
      for(const [k,n] of Object.entries(cache.goods)){const got=this.load(p,k,n);cache.goods[k]=Math.round((n-got)*100)/100;}
      if(Object.values(cache.goods).every(n=>n<=1e-9))cache.taken=true;
      return 'cache';
    }
    if(this.siteAt(x,y))return 'site';
    return short?'short':'moved';
  },
  // Shortest walk through known passable tiles. Danger tiles cost extra so known safe detours win.
  route(s,from,to){
    const C=this.C(),d=this.view(s),N=C.size,key=(x,y)=>y*N+x,dist=new Map([[key(...from),0]]),prev=new Map(),open=[[...from,0]];
    while(open.length){
      open.sort((a,b)=>a[2]-b[2]);const [x,y,g]=open.shift();
      if(x===to[0]&&y===to[1])break;
      if(g>dist.get(key(x,y)))continue;
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
        const nx=x+dx,ny=y+dy,t=this.terrain(nx,ny);
        if(!t||!t.pass||!this.isKnown(d,nx,ny))continue;
        const cost=g+1+(t.danger&&d.beetles!=='observed'?20:0),k=key(nx,ny);
        if(cost<(dist.get(k)??Infinity)){dist.set(k,cost);prev.set(k,[x,y]);open.push([nx,ny,cost]);}
      }
    }
    if(!dist.has(key(...to)))return null;
    const path=[];let cur=[...to];
    while(cur[0]!==from[0]||cur[1]!==from[1]){path.unshift(cur);cur=prev.get(key(...cur));}
    return path;
  },
  returnEstimate(s){
    const d=this.data(s),p=d?.party;if(!p)return null;
    const path=this.route(s,p.pos,this.C().home);if(!path)return {steps:null};
    const C=this.C(),danger=path.some(([x,y])=>this.terrain(x,y).danger)&&d.beetles!=='observed';
    return {steps:path.length,food:path.length*p.members*C.member.food,water:path.length*p.members*C.member.water,danger};
  },
  walkHome(s){
    const d=this.data(s),p=d?.party;if(!p||p.encounter)return false;
    const path=this.route(s,p.pos,this.C().home);if(!path)return false;
    for(const [x,y] of path){
      const r=this.move(s,x-p.pos[0],y-p.pos[1]);
      if(r!=='moved'&&r!=='cache')return r;
    }
    return 'moved';
  },
  arrive(s){
    const d=this.data(s),p=d.party,C=this.C(),brought={};
    for(const [k,n] of Object.entries(p.pack)){
      if(k==='water'||k==='archive'||n<=1e-9)continue;
      if(CivilCatalog.resources.includes(k)){s.stores[k]=(s.stores[k]||0)+n;brought[k]=n;}
    }
    if(p.pack.archive){d.sites.ruin.state='preserved';this.record(s,'ruin','旧气象站档案入库','风速纸带和撤离前的值班日志被晾干、编号，放进了工坊。');}
    if(p.hurt>0)d.resting={count:p.hurt,until:s.civilization.elapsed+C.injuryRest};
    const text=Object.entries(brought).map(([k,n])=>(CivilText.labels[k]||k)+' '+Math.round(n*100)/100).join('、');
    this.record(s,'trip','第'+d.trips+'次近郊往返',p.members+'人出发，走了'+p.steps+'步。'+(text?'带回 '+text+'。':'没有带回物资。')+(p.hurt?p.hurt+'人受伤需要休养。':''));
    d.party=null;
    return brought;
  },
  collapse(s){
    const d=this.data(s),p=d.party,C=this.C(),c=s.civilization,paid=CivilRules.pay(s,C.rescue);
    if((typeof CivilEquipment!=='undefined'&&CivilEquipment.enabled(s)))s.civilization.fieldEquipment.ammoSpent+=p.pack.ammunition||0;
    if(p.pack.archive&&d.sites.ruin.state==='carried')d.sites.ruin.state='new';
    d.resting={count:p.members,until:c.elapsed+(paid?C.injuryRest:C.injuryRest*2)};
    this.record(s,'rescue','近郊救援',p.members+'人在离家'+p.steps+'步处耗尽补给。'+(paid?'聚落拿出食物 '+C.rescue.food+'、木料 '+C.rescue.wood+' 组织救援，':'聚落拿不出救援物资，他们自己拖着身子回来，')+'背包里的东西都留在了荒地。');
    d.party=null;return paid;
  },
  // --- site and encounter choices; each returns a message or false ---
  choices(s){
    const d=this.data(s),p=d?.party;if(!p)return null;
    const C=this.C(),site=p.encounter==='beetle'?'beetle':this.siteAt(...p.pos);if(!site)return null;
    const out={site,options:[]},add=(id,text,reason=null)=>out.options.push({id,text,reason});
    if(site==='beetle'){
      add('back','退回原路绕开');
      if((typeof CivilEquipment!=='undefined'&&CivilEquipment.enabled(s))){add('shoot','开枪驱散（2发；枪声会招来追随者）',(p.pack.ammunition||0)<2?'携带弹药不足':null);add('silent','静默绕过（多耗两步口粮和水）',(p.pack.food||0)<p.members*C.member.food*2||(p.pack.water||0)<p.members*C.member.water*2?'补给不足':null);}
      add('smoke','点燃枯枝驱散（木料 2）',(p.pack.wood||0)+1e-9<2?'背包里没有木料':null);
      add('observe','伏低观察它们的习性（多耗一轮口粮和水）',(p.pack.food||0)<p.members*C.member.food*5||(p.pack.water||0)<p.members*C.member.water*5?'补给不够在原地停留':null);
      add('rush','硬闯过去');
    } else if(site==='station'){
      const st=d.sites.station;
      if(st.state==='new')add('recover','带回资料与零件');
      else add('strip','拆取站台固定件',st.stock<=0?'能拆的都拆完了':this.free(p)<1?'背包已满':null);
      add('leave','暂不处理');
    } else if(site==='pump'){
      const st=d.sites.pump;
      if(st.state!=='repaired'){
        add('repair','接通机械旁路（木料 '+C.repairKit.wood+'、废料 '+C.repairKit.scrap+'）',!s.civilization.tech.water?'工坊还没掌握净水工艺':!s.civilization.station?'还没找到泵站的维修图':(p.pack.wood||0)+1e-9<C.repairKit.wood||(p.pack.scrap||0)+1e-9<C.repairKit.scrap?'背包里没有足够的维修件':null);
        if(st.state==='new')add('survey','记下损坏情况');
      } else add('refill','在泵站灌满水壶',this.free(p)<.5?'背包已满':null);
      add('leave','离开');
    } else if(site==='ruin'){
      const st=d.sites.ruin;
      if(st.state==='new'){
        add('preserve','保全档案带回（重 '+C.weight.archive+'）',this.free(p)<C.weight.archive?'背包空间不足':null);
        add('dismantle','拆下仪器的金属件');
      } else if(st.state==='dismantled')add('strip','搬走剩下的金属件',st.stock<=0?'已经搬空':this.free(p)<1?'背包已满':null);
      add('leave','离开');
    } else if(site==='cellar'){
      const st=d.sites.cellar;
      if(st.state==='new'||st.state==='met'){add('share','留下口粮 3',(p.pack.food||0)+1e-9<3?'口粮不够分':null);add('ask','打听附近的情况');}
      if(st.state==='helped')add('invite','邀请他们来聚落安家');
      add('leave','离开');
    }
    return out;
  },
  choose(s,id){
    const d=this.data(s),p=d?.party,info=this.choices(s);
    const opt=info?.options.find(o=>o.id===id);if(!opt||opt.reason)return false;
    const C=this.C(),site=info.site,c=s.civilization;
    if(site==='beetle'){
      if(id==='shoot'){p.pack.ammunition-=2;c.fieldEquipment.ammoSpent+=2;p.noise=6;p.encounter=null;p.smoke=true;this.record(s,'beetle','近郊枪声','两发弹药实耗；眼前甲虫退开，枪声引来新的追随者。');return '枪声越过了荒地。眼前的虫群退开，远处有什么东西开始移动。';}
      if(id==='silent'){this.consume(p,2);p.encounter=null;p.smoke=true;p.noise=0;this.record(s,'beetle','静默绕行','小队花两步补给绕开，没有留下枪声。');return '脚步埋进湿土里。小队慢慢绕过洼地。';}
      if(id==='back'){p.pos=[...p.prev];p.encounter=null;return '小队退回了洼地边缘。';}
      if(id==='smoke'){p.pack.wood=Math.round((p.pack.wood-2)*100)/100;p.smoke=true;p.encounter=null;this.record(s,'beetle','烟驱甲虫','湿枝的烟让甲虫缩回了石缝。这次能过去，下次它们还会出来。');return '浓烟压低了洼地。甲虫缩回了碎石下面。';}
      if(id==='observe'){this.consume(p,5);d.beetles='observed';p.encounter=null;this.record(s,'beetle','记下灰壳甲虫的习性','甲虫在气温最低时停止活动。之后小队只在寒冷时段穿过洼地。');return '你们趴在碎石后面看了很久。气温降下来后，甲虫一只只僵住不动了。';}
      if(id==='rush'){const lost=Math.round((p.pack.food||0)*.4*100)/100;p.pack.food=Math.round(((p.pack.food||0)-lost)*100)/100;p.hurt=Math.min(p.members,p.hurt+1);p.smoke=true;p.encounter=null;this.record(s,'beetle','硬闯甲虫洼地','一人被咬伤，口粮袋被咬破，丢了 '+lost+' 份食物。');return '甲虫扑了上来。一个人的小腿被咬伤，口粮袋也破了。';}
    }
    if(id==='leave')return '小队没有动这里的东西。';
    if(site==='station'){
      const st=d.sites.station;
      if(id==='recover'){
        st.state='recovered';st.stock=40;c.station=true;c.visited.station=true;
        const got=this.load(p,'scrap',24);st.stock+=Math.round((24-got)*100)/100;
        this.record(s,'station','旧交通站','候车厅的货运表最后一班没有注销，目的地仍写着火星。维修图背面标着一座泵站。');
        this.reveal(d,4,19,0);
        return '带回了泵站路线和 '+got+' 份废料'+(got<24?'；背不下的留在站台。':'。');
      }
      if(id==='strip'){const got=this.load(p,'scrap',Math.min(8,st.stock));st.stock=Math.round((st.stock-got)*100)/100;return '拆下了 '+got+' 份废料。站台还剩约 '+Math.floor(st.stock)+' 份。';}
    }
    if(site==='pump'){
      const st=d.sites.pump;
      if(id==='survey'){st.state='surveyed';this.record(s,'pump','泵站勘明','控制柜断电，机械旁路还在。需要净水工艺与维修件。');return '控制柜停了电，但机械旁路还在。带上木料与废料，再来就能修。';}
      if(id==='repair'){p.pack.wood=Math.round((p.pack.wood-C.repairKit.wood)*100)/100;p.pack.scrap=Math.round((p.pack.scrap-C.repairKit.scrap)*100)/100;st.state='repaired';c.pump=true;c.visited.pump=true;
        this.record(s,'pump','泵站重新转动','照工坊的试制记录接好了过滤管。泵站成为小队的补水点，聚落可以沿管线设补给外站。');return '泵轮重新转动。这里成了小队的补水点。';}
      if(id==='refill'){const before=p.pack.water||0;this.load(p,'water',p.cap);return '水壶灌满了（+'+Math.round(((p.pack.water||0)-before)*100)/100+'）。';}
    }
    if(site==='ruin'){
      const st=d.sites.ruin;
      if(id==='preserve'){p.pack.archive=1;st.state='carried';return '你们把纸带卷好包进油布。它很重，但只要带回去，工坊就能读懂这片天气。';}
      if(id==='dismantle'){st.state='dismantled';const got=this.load(p,'scrap',st.stock);st.stock=Math.round((st.stock-got)*100)/100;this.record(s,'ruin','拆解旧气象站','仪器拆成了废料，纸质档案受潮散落，无法再整理。');return '拆下 '+got+' 份废料。湿透的纸带落了一地。';}
      if(id==='strip'){const got=this.load(p,'scrap',st.stock);st.stock=Math.round((st.stock-got)*100)/100;return '又搬走 '+got+' 份废料。';}
    }
    if(site==='cellar'){
      const st=d.sites.cellar;
      if(id==='share'){p.pack.food=Math.round((p.pack.food-3)*100)/100;st.state='helped';this.revealHints(s);this.record(s,'cellar','储藏室里的幸存者','小队留下 3 份口粮。老测量员画出了泵站与甲虫洼地的位置。');return '老测量员收下口粮，在地上画出泵站的方位，又提醒你们：洼地里的甲虫怕冷也怕烟。';}
      if(id==='ask'){st.state=st.state==='new'?'met':st.state;this.revealHints(s);return '他们不肯开门，只从缝里说：西南洼地有甲虫，泵站在更远的西边。';}
      if(id==='invite'){st.state='invited';d.survivors={count:3,invitedAt:c.elapsed};this.record(s,'cellar','邀请储藏室的人','他们答应等聚落空出三张床就搬过去。');return '老测量员说，等你们那边空出三张床、口粮够吃，他们就过去。';}
    }
    return false;
  },
  revealHints(s){const d=this.data(s);this.reveal(d,4,19,1);for(let x=6;x<=10;x++)this.reveal(d,x,15,1);if(d.beetles==='unknown')d.beetles='seen';},
  // Invited survivors move only when the home really has beds and food.
  tick(s){
    const d=this.data(s);if(!d)return null;
    if(d.resting&&d.resting.until<=s.civilization.elapsed){d.resting=null;return 'rested';}
    const v=d.survivors;if(!v||d.sites.cellar.state!=='invited')return null;
    const beds=CivilCatalog.capacity(s)-(s.game.population||0);
    if(beds<v.count||(s.stores.food||0)<12||s.civilization.hunger)return null;
    s.game.population+=v.count;if(typeof CivilCensus!=='undefined')CivilCensus.move(s,'cellar','home',v.count,'储藏室居民迁入');d.sites.cellar.state='joined';d.survivors=null;
    if(typeof CivilSociety!=='undefined')CivilSociety.sync(s);
    this.record(s,'cellar','储藏室的人搬进聚落','老测量员和两个徒弟住进了聚落。他记得旧城的道路编号。');
    return 'joined';
  },
  validate(state){
    const d=state.civilization.expedition;if(d===undefined)return;
    const C=this.C(),fin=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0,int=n=>Number.isSafeInteger(n)&&n>=0,obj=v=>v&&typeof v==='object'&&!Array.isArray(v),fail=()=>{throw Error('近郊勘察数据无效');};
    if(!obj(d)||d.schema!==1||!int(d.seed)||!int(d.trips)||!Array.isArray(d.known)||d.known.length!==C.size||d.known.some(n=>!int(n)||n>=2**C.size))fail();
    if(!obj(d.sites)||!['new','recovered'].includes(d.sites.station?.state)||!fin(d.sites.station.stock)||!['new','surveyed','repaired'].includes(d.sites.pump?.state)||!['new','carried','preserved','dismantled'].includes(d.sites.ruin?.state)||!fin(d.sites.ruin.stock)||!['new','met','helped','invited','joined'].includes(d.sites.cellar?.state))fail();
    if(!['unknown','seen','observed'].includes(d.beetles)||!Array.isArray(d.caches)||!Array.isArray(d.records))fail();
    for(const k of d.caches)if(!obj(k)||!int(k.x)||!int(k.y)||typeof k.taken!=='boolean'||!obj(k.goods)||Object.entries(k.goods).some(([g,n])=>!CivilCatalog.resources.includes(g)||!fin(n)))fail();
    if(d.resting!==null&&(!obj(d.resting)||!int(d.resting.count)||!fin(d.resting.until)))fail();
    if(d.survivors!==null&&(!obj(d.survivors)||!int(d.survivors.count)))fail();
    const p=d.party;
    if(p!==null){
      if(!obj(p)||!Number.isInteger(p.members)||p.members<1||p.members>C.maxMembers||!Array.isArray(p.pos)||!this.terrain(...p.pos)?.pass||!Array.isArray(p.prev)||!obj(p.pack)||!fin(p.cap)||!int(p.steps)||!int(p.hurt)||p.hurt>p.members||!int(p.starving)||![null,'beetle'].includes(p.encounter)||typeof p.smoke!=='boolean')fail();
      for(const [k,n] of Object.entries(p.pack))if(!(k in C.weight)||!fin(n))fail();
      if(this.weight(p.pack)>p.cap+1e-6)fail();if(p.noise!==undefined&&(!(typeof CivilEquipment!=='undefined'&&CivilEquipment.enabled(state))||!int(p.noise)||p.noise>6))fail();
      if((p.pack.archive||0)>0!==(d.sites.ruin.state==='carried'))fail();
    }
    if(this.unavailable(state)>(state.game.population||0))fail();
  },
  // ---------------- presentation (ADR-native DOM) ----------------
  render(s){
    const C=this.C(),d=this.view(s),p=d.party,lines=[];
    for(let y=0;y<C.size;y++){
      let row='';
      for(let x=0;x<C.size;x++){
        if(p&&p.pos[0]===x&&p.pos[1]===y){row+='<b class="civil-party">@</b>';continue;}
        if(!this.isKnown(d,x,y)){row+=' ';continue;}
        const t=this.tile(x,y),cache=d.caches.find(k=>!k.taken&&k.x===x&&k.y===y);
        if(cache){row+='<b>*</b>';continue;}
        row+=/[ATPRS]/.test(t)?'<b>'+t+'</b>':t;
      }
      lines.push(row);
    }
    return lines.join('\n');
  },
  places(s){
    const d=this.view(s),C=this.C(),out=[];
    const name={station:{new:'未勘察',recovered:'已回收资料'},pump:{new:'未勘察',surveyed:'待修复',repaired:'已修复 · 可补水'},ruin:{new:'档案未动',carried:'档案在小队背包里',preserved:'档案已入库',dismantled:'已拆解'},cellar:{new:'有人住',met:'隔门交谈过',helped:'已结识',invited:'等待空床搬来',joined:'已搬进聚落'}};
    for(let y=0;y<C.size;y++)for(let x=0;x<C.size;x++){
      const site=this.siteAt(x,y);if(!site||!this.isKnown(d,x,y))continue;
      const path=this.route(s,C.home,[x,y]);
      out.push(C.siteNames[site]+' · '+(name[site][d.sites[site].state]||'')+(path?' · 已知路线 '+path.length+' 步':' · 路线未明'));
    }
    if(d.beetles!=='unknown')out.push('甲虫洼地 · '+(d.beetles==='observed'?'已摸清习性，寒冷时段可安全穿过':'危险，可绕行'));
    return out;
  },
  ui:null,
  panel(){
    if($('#expeditionPanel').length)return $('#expeditionPanel');
    const box=$('<div>').attr({id:'expeditionPanel','data-legend':'近郊'}).addClass('civil-expedition').appendTo('#roadPanel');
    const host=typeof document.getElementById==='function'?document.getElementById('roadPanel'):null,el=box[0];if(host&&el&&host.firstChild!==el&&host.insertBefore)host.insertBefore(el,host.firstChild);
    $('<div>').attr({id:'expeditionStatus',role:'status'}).addClass('civil-brief').appendTo(box);
    const map=$('<div>').attr({id:'expeditionMap',role:'img'}).appendTo(box);
    // Touch: tap a side of the map relative to the party, or swipe, to take one step.
    let touch=null;
    map.on('touchstart',e=>{const t=e.originalEvent.touches[0];touch={x:t.clientX,y:t.clientY};});
    map.on('touchend',e=>{const t=e.originalEvent.changedTouches[0];if(!touch)return;const dx=t.clientX-touch.x,dy=t.clientY-touch.y;touch=null;
      if(Math.max(Math.abs(dx),Math.abs(dy))<24)return;e.preventDefault();this.stepToward(dx,dy);});
    map.on('click',e=>{const p=this.data(State)?.party;if(!p)return;const at=map.find('.civil-party')[0];if(!at)return;const r=at.getBoundingClientRect();this.stepToward(e.clientX-(r.left+r.width/2),e.clientY-(r.top+r.height/2));});
    $('<div>').attr('id','expeditionControls').appendTo(box);
    const list=$('<details>').attr('id','expeditionPlaces').addClass('civil-details').appendTo(box);
    $('<summary>').text('已知地点与图例').appendTo(list);$('<ul>').appendTo(list);
    $('<p>').addClass('civil-legend').text('@ 小队　A 家园　T 交通站　P 泵站　R 旧气象站　S 储藏室　* 散落物资　# 旧公路　= 渠堤　; 枯林　, 草甸　. 灰原　% 甲虫洼地　^ 坍塌高架　~ 积水').appendTo(list);
    return box;
  },
  step(label,aria,fn){return $('<span>').addClass('civil-step').attr({role:'button',tabindex:0,'aria-label':aria}).text(label).on('click',fn).on('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();fn();}});},
  act(fn){const r=fn();this.after();return r;},
  after(){$SM.fireUpdate('stores');if(typeof Outside!=='undefined'){Outside.updateVillage?.();Outside.updateWorkersView?.();}Civilization.updateIncome();this.refresh(true);Engine.saveGame();},
  moveUI(dx,dy){
    const r=this.act(()=>this.move(State,dx,dy));
    if(r&&typeof CivilSound!=='undefined')CivilSound.effect(r==='encounter'?'audio/encounter-tier-1.flac':'audio/footsteps-1.flac');
    if(r==='home')Civilization.notify(this.C().text.home);
    else if(r==='collapse')Civilization.notify(this.C().text.collapse+' 背包留在了荒地，小队带伤回到聚落。');
    else if(r==='encounter')this.openChoices();
    else if(r==='site')this.openChoices();
    else if(r==='cache')Civilization.notify('在路边的翻倒车厢里找到了一些还能用的东西。');
    else if(r==='short')Civilization.notify(this.C().text.hungry);
    return r;
  },
  stepToward(dx,dy){if(Math.abs(dx)<6&&Math.abs(dy)<6)return null;return Math.abs(dx)>Math.abs(dy)?this.moveUI(dx>0?1:-1,0):this.moveUI(0,dy>0?1:-1);},
  openChoices(){
    const info=this.choices(State);if(!info||Events.activeEvent())return false;
    const C=this.C(),d=this.data(State),title=info.site==='beetle'?'甲虫洼地':C.siteNames[info.site],buttons={};
    const text={beetle:[C.text.beetle,'可以退回绕路，也可以想办法过去。'],
      station:d.sites.station.state==='new'?['候车厅的墙上挂着地球与火星之间的货运表。最后一班没有注销。','你认得表格上的航运标准。火星上的人曾经也是这里的乘客。维修图背面标着一座泵站。']:['站台空荡荡的。还有些固定件能拆。'],
      pump:d.sites.pump.state==='repaired'?['泵轮在转。清水从过滤管里流出来。']:['水从裂开的管道漏进地下。控制柜已经停电，机械旁路还在。'],
      ruin:d.sites.ruin.state==='new'?['屋顶的风杯早就不转了。值班室里堆着一卷卷风速纸带，最后一页写着：轨道补给中断，全员撤离。','纸带能告诉你们这里的寒潮什么时候来；仪器外壳和支架则是现成的金属。只能二选一。']:['旧气象站只剩空架子。']
      ,cellar:['半埋的储藏室门口压着沙袋。门缝里有灯，一位老测量员带着两个年轻徒弟守在里面。',d.sites.cellar.state==='helped'?'他们认得你们了。':'他们不认识你们，也不急着出来。']}[info.site];
    for(const o of info.options)buttons['ex_'+o.id]={text:o.text+(o.reason?'（'+o.reason+'）':''),nextScene:'end',available:()=>!o.reason,onChoose:()=>{const msg=this.choose(State,o.id);if(msg){Civilization.notify(msg);if(o.id==='shoot'&&typeof CivilSound!=='undefined')CivilSound.effect('audio/weapon-ranged-1.flac');}this.after();}};
    Events.startEvent({title,scenes:{start:{text,buttons}}});return true;
  },
  keyUp(e){
    if(Events.activeEvent()||!this.data(State)?.party)return;
    const k={37:[-1,0],65:[-1,0],38:[0,-1],87:[0,-1],39:[1,0],68:[1,0],40:[0,1],83:[0,1]}[e.which];
    if(k)this.moveUI(...k);
  },
  attach(module){module.keyUp=e=>this.keyUp(e);module.keyDown=()=>{};},
  // A party standing on an unresolved encounter (e.g. after reload) gets the choice back once,
  // without spending a step or time; closing is never a default choice.
  resumeChoice(s){
    const p=this.data(s)?.party;if(!p||typeof Events==='undefined'||Events.activeEvent())return false;
    if(p.encounter!=='beetle')return false;
    return this.openChoices();
  },
  signature:null,
  refresh(force=false){
    // Renders only into a real browser panel; rule harnesses with DOM stubs skip presentation.
    const s=State;if(!this.unlocked(s)||typeof document==='undefined'||typeof document.getElementById!=='function'||!document.getElementById('roadPanel'))return;
    if(Civilization.roadModule&&!Civilization.roadModule.keyUp)this.attach(Civilization.roadModule);
    if(Engine.activeModule===Civilization.roadModule)this.resumeChoice(s);
    const box=this.panel(),d=this.view(s),p=d.party,C=this.C();
    const sig=JSON.stringify([d.known,p,d.sites,d.caches,d.beetles,d.resting,this.prep,s.stores.food|0,s.stores.wood|0,s.stores.scrap|0,this.freeHands(s),s.civilization.tech.water,!!s.civilization.station,!!Events.activeEvent?.(),this.legacyJourney(s)]);
    if(!force&&sig===this.signature)return;this.signature=sig;
    const explored=d.known.reduce((n,row)=>{let m=0;for(let x=0;x<C.size;x++)if(row&(1<<x))m++;return n+m;},0);
    $('#expeditionMap').html(this.render(s)).attr('aria-label','近郊地图，已勘明 '+explored+' 格'+(p?'，小队位于 '+(this.terrain(...p.pos).name):''));
    const status=p?(this.terrain(...p.pos).name+' · '+p.members+' 人在外 · 已走 '+p.steps+' 步'):(d.resting&&d.resting.until>s.civilization.elapsed?d.resting.count+' 人正在休养，还需 '+Math.ceil(d.resting.until-s.civilization.elapsed)+' 秒':C.text.intro);
    $('#expeditionStatus').text('已勘明 '+Math.round(explored/(C.size*C.size)*100)+'% · '+status);
    const ctl=$('#expeditionControls').empty();
    if(p){
      const w=this.weight(p.pack),est=this.returnEstimate(s);
      $('<div>').addClass('civil-pack').text('背包 '+Math.round(w*10)/10+' / '+p.cap+' · '+Object.entries(p.pack).filter(([,n])=>n>1e-9).map(([k,n])=>(k==='water'?'饮水':k==='archive'?'气象档案':CivilText.labels[k]||k)+' '+(k==='archive'?'':Math.round(n*100)/100)).join('、')).appendTo(ctl);
      if(est)$('<div>').addClass('civil-pack').toggleClass('civil-warning',est.steps!==null&&(est.food>(p.pack.food||0)||est.water>(p.pack.water||0))).text(est.steps===null?'返程：没有已知路线':'返程约 '+est.steps+' 步，需口粮 '+Math.round(est.food*10)/10+'、饮水 '+Math.round(est.water*10)/10+(est.danger?'；途经甲虫洼地':'')+(est.food>(p.pack.food||0)||est.water>(p.pack.water||0)?' · 补给不够返程':'')).appendTo(ctl);
      if(p.hurt)$('<div>').addClass('civil-pack').text(p.hurt+' 人受伤').appendTo(ctl);
      const pad=$('<div>').addClass('civil-pad').appendTo(ctl);
      for(const [label,aria,dx,dy] of [['↑ 北','向北走一格',0,-1],['← 西','向西走一格',-1,0],['→ 东','向东走一格',1,0],['↓ 南','向南走一格',0,1]]){
        const r=this.moveReason(s,dx,dy);this.step(label,aria+(r?'：'+r:''),()=>this.moveUI(dx,dy)).toggleClass('disabled',!!r).attr('title',r||'').appendTo(pad);
      }
      const back=Civilization.button('expeditionReturn','沿已知路返家',ctl,()=>{const r=this.act(()=>this.walkHome(State));if(r==='home')Civilization.notify(C.text.home);else if(r==='encounter'||r==='site')this.openChoices();else if(r==='collapse')Civilization.notify(C.text.collapse);});
      back.appendTo(ctl);Button.setDisabled(back,!est||est.steps===null||!!p.encounter||!!Events.activeEvent());
      if(this.choices(s)){const look=Civilization.button('expeditionLook',p.encounter?'处理眼前情况':'查看此处',ctl,()=>this.openChoices());look.appendTo(ctl);Button.setDisabled(look,!!Events.activeEvent());}
    } else {
      const pr=this.prep,cap=this.capacity(s,pr.members),pack={food:pr.food,water:pr.water,...(pr.kit?C.repairKit:{}),...(pr.armed&&(typeof CivilEquipment!=='undefined'&&CivilEquipment.enabled(s))?{ammunition:4}:{})},w=this.weight(pack);
      const row=(label,key,stepN,min,max,unit)=>{
        const r=$('<div>').addClass('civil-outfit').appendTo(ctl);$('<span>').addClass('civil-outfit-name').text(label).appendTo(r);
        this.step('−','减少'+label,()=>{pr[key]=Math.max(min,Math.round((pr[key]-stepN)*100)/100);this.refresh(true);}).appendTo(r);
        $('<span>').addClass('civil-outfit-val').text(pr[key]).appendTo(r);
        this.step('＋','增加'+label,()=>{pr[key]=Math.min(max,Math.round((pr[key]+stepN)*100)/100);this.refresh(true);}).appendTo(r);
        if(unit)$('<span>').addClass('civil-outfit-note').text(unit).appendTo(r);
      };
      row('队员','members',1,1,C.maxMembers,'空闲居民 '+Math.max(0,this.freeHands(s))+' · 每人背 '+C.capacity.member+((s.game.buildings.cart||0)>0?'，推车 +'+C.capacity.cart:''));
      row('口粮','food',1,0,60,'每步每人 '+C.member.food);
      row('饮水','water',1,0,60,'每步每人 '+C.member.water+' · 煮水每份木料 '+this.waterWood(s));
      const kit=$('<div>').addClass('civil-outfit').appendTo(ctl);
      this.step(pr.kit?'☑ 带泵站维修件':'☐ 带泵站维修件','切换是否携带泵站维修件',()=>{pr.kit=!pr.kit;this.refresh(true);}).attr('aria-pressed',pr.kit?'true':'false').appendTo(kit);
      $('<span>').addClass('civil-outfit-note').text('木料 '+C.repairKit.wood+'、废料 '+C.repairKit.scrap).appendTo(kit);
      if((typeof CivilEquipment!=='undefined'&&CivilEquipment.enabled(s))&&s.civilization.fieldEquipment?.gun)this.step(pr.armed?'☑ 携带猎枪与4发弹药':'☐ 携带猎枪与4发弹药','切换是否携带猎枪与弹药',()=>{pr.armed=!pr.armed;this.refresh(true);}).attr('aria-pressed',String(pr.armed)).appendTo(ctl);
      const reach=pr.members*C.member.food>0?Math.floor(Math.min(pr.food/(pr.members*C.member.food),pr.water/(pr.members*C.member.water))):0;
      const cost=this.departCost(s,pr);
      $('<div>').addClass('civil-pack').toggleClass('civil-warning',w>cap).text('背负 '+Math.round(w*10)/10+' / '+cap+' · 补给可走约 '+reach+' 步（往返各半） · 出发扣除 '+Object.entries(cost).map(([k,n])=>(CivilText.labels[k]||k)+' '+n).join('、')).appendTo(ctl);
      const reason=this.departReason(s);
      const go=Civilization.button('expeditionDepart','出发',ctl,()=>{if(this.act(()=>this.depart(State)))Civilization.notify(C.text.depart(this.data(State).party.members));});
      go.appendTo(ctl);Button.setDisabled(go,!!reason);go.attr('title',reason||'');
      if(reason)$('<div>').addClass('civil-pack civil-muted').text(reason).appendTo(ctl);
    }
    $('#expeditionPlaces ul').html(this.places(s).map(t=>$('<li>').text(t)));
  },
  reset(){this.signature=null;this.prep={members:1,food:4,water:6,kit:false};}
};
