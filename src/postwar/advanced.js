/* MPL-2.0 — A consumer of the caller's single power budget; never an independent economy timer. */
var CivilAdvanced={
  init(s){if(s.civilization.advanced===undefined)s.civilization.advanced={schema:1,made:{minerals:false,chemicals:false,steel:false,glass:false}};},
  buildings:{},
  remoteFacilities:CivilAdvancedContent.facilities,
  node(s,id='home'){return id==='home'?{stores:s.stores,workers:s.game.workers,buildings:s.game.buildings}:s.civilization.regions?.nodes[id];},
  facilities(s,id='home'){return id==='home'?s.game.buildings:s.civilization.municipal?.nodes[id]?.buildings||{};},
  capacity(s,job,id='home'){return id==='home'?CivilCatalog.jobCapacity(s,job):typeof CivilMunicipal!=='undefined'?(CivilMunicipal.jobCapacity(s,id)[job]||0):0;},
  workers(s,job,id='home'){return Math.min(this.node(s,id)?.workers[job]||0,this.capacity(s,job,id));},
  gate(s,type,id='home'){
    const c=s.civilization,b=this.facilities(s,id),a=c.advanced;
    if(!c.tech.chemistry)return false;
    if(type==='mineralquarry')return true;
    if(type==='chemicalworks')return !!a?.made.minerals;
    if(type==='steelworks')return !!c.tech.steel;
    if(!a?.made.chemicals)return false;
    if(type==='glassworks')return true;
    if(type==='utilitypower')return !!c.tech.power;
    if(type==='mineexpansion')return !!b.mine;
    if(type==='coalexpansion')return !!b.coalpit;
    if(type==='filterplant')return !!(c.tech.power&&c.tech.water);
    return false;
  },
  generationCapacity(s,id='home'){return this.capacity(s,'utilityworker',id)*10+(typeof CivilWind!=='undefined'?CivilWind.capacity(s,id):0);},
  demandCapacity(s,id='home'){return this.capacity(s,'chemist',id)*2+this.capacity(s,'steelworker',id)*2+this.capacity(s,'glassworker',id)+(this.facilities(s,id).filterplant||0)*2;},
  demand(s,id='home'){return this.workers(s,'chemist',id)*2+this.workers(s,'steelworker',id)*2+this.workers(s,'glassworker',id)+(this.facilities(s,id).filterplant||0)*2;},
  prepare(s,{factor,run},id='home'){
    this.init(s);const mined=run('mineralworker',this.workers(s,'mineralworker',id),{tools:.03},{minerals:1.2*factor});
    if(mined>0&&factor>0)s.civilization.advanced.made.minerals=true;
    const generators=run('utilityworker',this.workers(s,'utilityworker',id),{coal:.9,parts:.03},{});
    const wind=typeof CivilWind!=='undefined'?CivilWind.prepare(s,id,{factor,run}):0;
    return {generation:generators*10*factor+wind,pollution:generators*.04};
  },
  run(s,{factor,run,powerAvailable},id='home'){
    this.init(s);let remaining=Math.max(0,powerAvailable),used=0,pollution=0;
    const count=this.facilities(s,id).filterplant||0,filters=Math.min(count,Math.floor((remaining+1e-8)/2));
    const cleaned=run('工区净化',filters,{chemicals:.03,wood:.2,parts:.02},{});used+=cleaned*2;remaining-=cleaned*2;pollution-=cleaned*.8;
    const recipes=[
      {job:'chemist',resource:'chemicals',power:2,electric:{minerals:.4,coal:.2,tools:.01},thermal:{minerals:.4,coal:.3,tools:.01},fast:.4,slow:.12,smoke:.035},
      {job:'steelworker',resource:'steel',power:2,electric:{iron:1.2,coal:.5,chemicals:.05,tools:.01},thermal:{iron:1.2,coal:.7,chemicals:.05,tools:.01},fast:.6,slow:.3,smoke:.06},
      {job:'glassworker',resource:'glass',power:1,electric:{minerals:.6,coal:.25},thermal:{minerals:.6,coal:.4},fast:.5,slow:.2,smoke:.025}
    ];
    for(const recipe of recipes){
      const workers=this.workers(s,recipe.job,id),canPower=Math.min(workers,Math.floor((remaining+1e-8)/recipe.power));
      const powered=run(recipe.job,canPower,recipe.electric,{[recipe.resource]:recipe.fast*factor});remaining-=powered*recipe.power;used+=powered*recipe.power;
      const thermal=run(recipe.job,workers-powered,recipe.thermal,{[recipe.resource]:recipe.slow*factor});
      if((powered+thermal)>0&&factor>0)s.civilization.advanced.made[recipe.resource]=true;
      pollution+=(powered+thermal)*recipe.smoke;
      if(id==='home'&&workers>powered&&!s.civilization.industry.blocked[recipe.job])s.civilization.industry.blocked[recipe.job]='电力不足，部分工序改用煤热';
    }
    return {used,demand:this.demand(s,id),pollution};
  },
  refresh(){
    const s=State;if(!s.civilization.tech.chemistry)return;CivilIndustry.ensureLocation();
    for(const id of Object.keys(this.buildings)){
      const button=Room.Craftables[id]?.button;if(button?.length&&button.parent().attr('id')!=='industryBuildBtns')button.appendTo('#industryBuildBtns');$('#building_row_'+id).hide();
      let row=$('#industry_count_'+id);const count=s.game.buildings[id]||0;
      if(count&&!row.length){row=$('<div>').addClass('storeRow').attr('id','industry_count_'+id).appendTo('#industryStructures');$('<div>').addClass('row_key').text(_(id)).appendTo(row);$('<div>').addClass('row_val').appendTo(row);$('<div>').addClass('clear').appendTo(row);}
      row.toggle(count>0).find('.row_val').text(count);
    }
    if(Engine.activeModule===Outside&&$('#village').length)$('#storesContainer').css('top',($('#village').height()+26+Outside._STORES_OFFSET)+'px');
  },
  reset(){},
  validate(s){
    const a=s.civilization.advanced;if(a===undefined)return;
    if(!a||typeof a!=='object'||Array.isArray(a)||a.schema!==1||!a.made||typeof a.made!=='object'||Array.isArray(a.made)||Object.keys(a.made).length!==4||CivilAdvancedContent.resources.some(key=>typeof a.made[key]!=='boolean'))throw Error('先进材料记录无效');
    if(Object.values(a.made).some(Boolean)&&!s.civilization.tech.chemistry || a.made.steel&&!s.civilization.tech.steel)throw Error('先进材料工序尚未研究');
    for(const [id,facility]of Object.entries(CivilAdvancedContent.facilities)){
      const count=s.game.buildings[id];if(count!==undefined&&(!Number.isInteger(count)||count<0||count>facility.max||count>0&&!this.gate(s,id)))throw Error('先进工厂无效');
    }
  }
};
for(const [id,facility]of Object.entries(CivilAdvancedContent.facilities))CivilAdvanced.buildings[id]={cost:()=>({...facility.cost}),max:facility.max,gate:()=>CivilAdvanced.gate(State,id)};
