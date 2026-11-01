/* MPL-2.0 — Tick-based industrial material conversion and instantaneous electrical capacity. */
var CivilIndustry = {
  init(s) {
    if(s.civilization.industry===undefined)s.civilization.industry={schema:1,mineKnown:false,pollution:0,generation:0,demand:0,used:0,productionPower:0,online:false,announcedPower:false,blocked:{}};
  },
  buildings:{
    mine:{cost:()=>({wood:160+(State.game.buildings.mine||0)*80,tools:15}),max:2,gate:()=>State.civilization.tech.mining},
    coalpit:{cost:()=>({wood:140+(State.game.buildings.coalpit||0)*70,tools:12}),max:2,gate:()=>State.civilization.tech.mining},
    furnace:{cost:()=>({wood:180,scrap:40,tools:15}),max:2,gate:()=>State.civilization.tech.furnace},
    machineworks:{cost:()=>({wood:160,iron:40,tools:20}),max:2,gate:()=>State.civilization.tech.mechanics},
    powerhouse:{cost:()=>({wood:200,iron:50,parts:12,tools:20}),max:2,gate:()=>State.civilization.tech.power},
    scrubber:{cost:()=>({wood:100,iron:20,parts:10}),max:1,gate:()=>State.civilization.tech.power && State.civilization.tech.water}
  },
  journeys:{geology:{cost:{food:20,tools:6,knowledge:10},duration:240,allowed:s=>!!s.civilization.village?.town && !!s.civilization.tech.records && !!s.civilization.tech.handtools && !s.civilization.industry.mineKnown}},
  event(id,done) {
    if(id!=='geology')return null;
    return {title:'山坡下的矿带',text:['旧采石场的断面露出红褐色矿层。另一条沟谷里，煤层还没有被水淹没。','队伍在图上标出入口和风向。开采需要支护与通风，不能把拾荒时的办法照搬到井下。'],buttons:{
      survey:{text:'记录矿带与通风口',nextScene:'end',onChoose:done('矿带已记入地图。工坊开始整理支护与通风方案。',()=>{State.civilization.industry.mineKnown=true;})}
    }};
  },
  factor(s) {
    const c=s.civilization;
    return (CivilRules.policies[c.policy]||CivilRules.policies.equal).output*(c.hunger>=30?.65:1)*((c.village?.health??80)<30?.75:1)*(typeof CivilSociety!=='undefined'?CivilSociety.outputFactor(s):1);
  },
  jobCount(s,job) {return Math.min(s.game.workers[job]||0,CivilCatalog.jobCapacity(s,job));},
  // Caller invokes once per existing 10-second production settlement, after residents/services.
  // It can also invoke on a deep-cloned state to obtain exact resource tooltips without mutation.
  settle(s) {
    this.init(s);
    const i=s.civilization.industry,b=s.game.buildings,flow={},factor=this.factor(s);
    const oldPollution=i.pollution;
    i.blocked={};i.generation=0;i.demand=0;i.used=0;i.productionPower=0;i.online=false;
    const run=(job,count,cost,output) => {
      const name=CivilCatalog.jobs[job]||job;
      if(!count)return 0;
      let n=count;
      for(const [key,amount]of Object.entries(cost))n=Math.min(n,Math.floor(((s.stores[key]||0)+1e-8)/amount));
      if(n<count)i.blocked[job]='缺少原料或维护物资';
      const deltas=flow[name]||(flow[name]={});
      for(const [key,amount]of Object.entries(cost))deltas[key]=(deltas[key]||0)-n*amount;
      for(const [key,amount]of Object.entries(output))deltas[key]=(deltas[key]||0)+n*amount;
      for(const [key,amount]of Object.entries(cost))if(n)s.stores[key]=Math.max(0,(s.stores[key]||0)-n*amount);
      for(const [key,amount]of Object.entries(output))if(n)s.stores[key]=(s.stores[key]||0)+n*amount;
      return n;
    };
    run('miner',this.jobCount(s,'miner'),{tools:.03},{ore:1.2*factor});
    run('collier',this.jobCount(s,'collier'),{tools:.03},{coal:factor});
    const smelting=run('smelter',this.jobCount(s,'smelter'),{ore:1.2,coal:.6,tools:.01},{iron:.6*factor});
    const generators=run('electrician',this.jobCount(s,'electrician'),{coal:.6,parts:.02},{});
    const advanced=typeof CivilAdvanced!=='undefined'?CivilAdvanced:null;
    const prepared=advanced?advanced.prepare(s,{factor,run}):{generation:0,pollution:0};
    // Output debuffs affect generation too; unused capacity is discarded at the next settlement.
    i.generation=generators*4*factor+prepared.generation;i.online=i.generation>0;
    let remainingPower=i.generation;
    const machines=this.jobCount(s,'machinist');
    i.demand=machines*2+(b.scrubber?1:0)+(advanced?advanced.demand(s):0);
    if(typeof CivilServices!=='undefined'&&CivilServices.run){
      const service=CivilServices.run(s,'home',{factor,run,powerAvailable:remainingPower});
      if(!Number.isFinite(service.used)||service.used<0||service.used>remainingPower+1e-8||!Number.isFinite(service.demand)||service.demand<service.used)throw Error('公共服务电力预算无效');
      remainingPower-=service.used;i.used+=service.used;i.demand+=service.demand;
    }
    let scrubbed=false;
    if(b.scrubber && remainingPower>=1 && CivilRules.pay(s,{wood:.2,parts:.01})) {
      remainingPower-=1;i.used+=1;scrubbed=true;flow['烟尘处理']={wood:-.2,parts:-.01};
    }
    const materials=advanced?advanced.run(s,{factor,run,powerAvailable:remainingPower}):{used:0,pollution:0};
    if(materials.used<0||materials.used>remainingPower+1e-8)throw Error('先进工序电力预算无效');
    remainingPower-=materials.used;i.used+=materials.used;
    // Manual production remains possible if the coal/maintenance chain is interrupted.
    const powered=Math.min(machines,Math.floor((remainingPower+1e-8)/2));
    const poweredRuns=run('machinist',powered,{iron:.5,scrap:.2,tools:.01},{parts:.5*factor});
    i.productionPower=poweredRuns*2;i.used+=i.productionPower;
    const manualRuns=run('machinist',machines-poweredRuns,{iron:.5,scrap:.2,tools:.01},{parts:.3*factor});
    if(machines>powered && machines>0 && !i.blocked.machinist)i.blocked.machinist='电力不足，部分岗位改用手动工序';
    i.pollution=Math.max(0,Math.min(100,oldPollution+smelting*.05+generators*.03+prepared.pollution+materials.pollution-(scrubbed?.4:.02)));
    if(i.pollution>=40 && s.civilization.village)s.civilization.village.health=Math.max(0,s.civilization.village.health-.05*(1+i.pollution/50));
    return flow;
  },
  tick(s) {
    const i=s.civilization.industry;
    if(i.online && !i.announcedPower){i.announcedPower=true;Civilization.notify('工区第一次持续供电。电工守着发电机，机械作坊的传动轴转了起来。');}
  },
  validate(s) {
    const i=s.civilization.industry;
    if(i===undefined)return; // Older saves initialize a blank industrial state only after a successful decode.
    if(!i || typeof i!=='object' || Array.isArray(i) || i.schema!==1 || typeof i.mineKnown!=='boolean' || typeof i.online!=='boolean' || typeof i.announcedPower!=='boolean')throw Error('工业状态无效');
    // Last-tick evidence can outlive worker reassignment or a policy change. Bound it by built capacity and all legal output bonuses.
    const maxFactor=Math.max(...Object.values(CivilRules.policies).map(p=>p.output))*1.18;
    const generationCapacity=CivilCatalog.jobCapacity(s,'electrician')*4+(typeof CivilAdvanced!=='undefined'?CivilAdvanced.generationCapacity(s):0);
    const demandCapacity=CivilCatalog.jobCapacity(s,'machinist')*2+(s.game.buildings.scrubber?1:0)+(typeof CivilAdvanced!=='undefined'?CivilAdvanced.demandCapacity(s):0)+(typeof CivilServices!=='undefined'&&CivilServices.demandCapacity?CivilServices.demandCapacity(s,'home'):0);
    const limits={pollution:100,generation:generationCapacity*maxFactor,demand:demandCapacity,used:Math.min(generationCapacity*maxFactor,demandCapacity)};
    for(const [key,limit]of Object.entries(limits))if(!Number.isFinite(i[key])||i[key]<0||i[key]>limit+1e-8)throw Error('工业数值超过设施容量');
    if(i.used>i.generation+1e-8 || i.used>i.demand+1e-8)throw Error('电力负载无效');
    // Older saves had no dedicated machine-load evidence. Do not infer it from other industrial/service consumption.
    if(i.productionPower!==undefined&&(!Number.isFinite(i.productionPower)||i.productionPower<0||i.productionPower>CivilCatalog.jobCapacity(s,'machinist')*2+1e-8||i.productionPower>i.used+1e-8))throw Error('机械生产用电无效');
    if(i.online!==(i.generation>0))throw Error('电站状态无效');
    if(!i.blocked || typeof i.blocked!=='object' || Array.isArray(i.blocked))throw Error('工业岗位状态无效');
    for(const [job,reason]of Object.entries(i.blocked))if(!Object.hasOwn(CivilCatalog.jobs,job)&&job!=='工区净化' || typeof reason!=='string')throw Error('工业岗位状态无效');
  },
  reset() {this.module=null;},
  ensureLocation() {
    if(this.module)return;
    const module=this.module={onArrival(diff){document.title='工区';Engine.moveStoresView(null,diff);}};
    module.tab=Header.addLocation('工区','industry',module);
    module.panel=$('<div>').attr('id','industryPanel').addClass('location').appendTo('#locationSlider');
    $('<div>').attr('id','industryStatus').css({width:'410px',lineHeight:'1.8',marginBottom:'25px'}).appendTo(module.panel);
    const columns=$('<div>').attr('id','industryColumns').css('position','relative').appendTo(module.panel);
    $('<div>').attr({'id':'industryBuildBtns','data-legend':'建设：'}).appendTo(columns);
    $('<div>').attr('id','industryStructures').css({position:'absolute',left:'160px',top:0,width:'150px'}).appendTo(columns);
    Engine.updateSlider();
  },
  refresh() {
    const s=State,i=s.civilization.industry;
    if(s.civilization.village?.town && !i.mineKnown) {
      const r=this.journeys.geology;
      const btn=Civilization.button('geologyButton','勘察矿带','#roadPanel',()=>Civilization.depart('geology'),r.cost);
      Button.setDisabled(btn,!!s.civilization.journey || !!s.civilization.pending || !CivilRules.canPay(s,r.cost));
      btn.attr('title','240 秒；记录矿点后才能研究开采');
    }
    $('#geologyButton').toggle(!i.mineKnown);
    if(!s.civilization.tech.mining)return;
    this.ensureLocation();
    for(const id of Object.keys(this.buildings)) {
      const button=Room.Craftables[id]?.button;
      if(button?.length && button.parent().attr('id')!=='industryBuildBtns')button.appendTo('#industryBuildBtns');
      // Keep the existing settlement inventory column within ADR's height as industry grows.
      $('#building_row_'+id).hide();
      let row=$('#industry_count_'+id);
      const n=s.game.buildings[id]||0;
      if(n && !row.length){
        row=$('<div>').addClass('storeRow').attr('id','industry_count_'+id).appendTo('#industryStructures');
        $('<div>').addClass('row_key').text(_(id)).appendTo(row);
        $('<div>').addClass('row_val').appendTo(row);
        $('<div>').addClass('clear').appendTo(row);
      }
      row.toggle(n>0).find('.row_val').text(n);
    }
    if(Engine.activeModule===Outside && $('#village').length)$('#storesContainer').css('top',($('#village').height()+26+Outside._STORES_OFFSET)+'px');
    let text='矿带已记录。原料、燃料和加工岗位必须相互配合。';
    if(s.game.buildings.furnace)text+=' 烟尘 '+Math.floor(i.pollution)+(i.pollution>=40?'，正在影响居民健康。':'。');
    if(s.game.buildings.powerhouse||s.game.buildings.utilitypower)text+=' 电力 '+Number(i.used.toFixed(2))+' / '+Number(i.generation.toFixed(2))+'，需求 '+Number(i.demand.toFixed(2))+'；每轮即时使用。';
    $('#industryStatus').text(text);
    for(const [job,reason]of Object.entries(i.blocked))$('#workers_row_'+job).attr('title',reason+'；岗位上限 '+CivilCatalog.jobCapacity(s,job));
  }
};
