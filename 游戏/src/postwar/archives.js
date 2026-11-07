/* MPL-2.0 — Adaptation fiction, revealed by real actions. These are not claims of novel canon. */
var CivilArchives={
 enabled(s){return s.civilization?.polishVersion===1;},
 init(s){if(this.enabled(s)&&!s.civilization.archives)s.civilization.archives={schema:1,records:{},stages:{},achievements:{}};},
 chains:{facilities:'谁留下这些设施',belonging:'谁属于共同体',inheritance:'谁接过这把火',mutation:'变异与生态',machines:'机群',echo:'回响',mars:'火星',flight:'首航'},
 nodes(s){const c=s.civilization,f=c.polity?.future,g=c.polity?.earth,exp=c.expedition,p=c.generations?.people||{},out=[];const add=(id,chain,title,lines,ready)=>out.push({id,chain,title,lines,ready:!!ready});
  add('facility_station','facilities','没有注销的班次',['候车厅的货运表停在最后一班。维修编号的日期，却比停航日期还晚。','战后曾有人摸黑回来过，换了阀门，又拿砂纸把签单上的名字擦得干干净净。'],c.station);
  add('facility_pump','facilities','旁路上的手印',['断电的防爆柜旁，有人焊了一条能纯手动摇开的旁路管道。','她没能保住整台机器，只给后来人留下了靠扳手就能对付的部分。'],c.pump);
  add('facility_grid','facilities','把图纸交出去',['全域电网合闸那夜，档案员坚持把油印接线图分发到每一处配电站。','不该只有某一个人，知道该怎样让灯亮起来。'],c.modern?.modernRounds>=6||c.tech.power);
  add('belonging_ration','belonging','第一份口粮约定',['泛黄的软皮本上最初只有几个名字。空行比名字多，浸着盐碱和水渍。','有人把干粮掰开，问了一句：下一个推门进屋的人，算不算在这张契约里？'],c.policy);
  add('belonging_mutant','belonging','没有单独一页',['一名指骨生着硬角质的居民，默不作声地把旧表格翻到了背面。','他在空白处写下自己的工种、家人与门牌，而不是生理筛查栏里的异样数据。'],p.mutant||c.society?.governed&&c.society.cohorts.some(x=>x.identity==='mutant'));
  add('belonging_citizen','belonging','一份能够离开的约定',['共同法典最终写下了迁徙自决、私留财产与仲裁申诉的明文。','真正的归属不只是领受庇护，更是保有在某项安排前说“不”的权利。'],c.polity?.foundedAt&&c.polity.laws.rights==='equal');
  add('inheritance_workshop','inheritance','工匠的桌面',['工匠把磨得只剩两指长的铅笔头，随手掖进了机修间的门框缝。','她说：铁料和机油总有耗尽的一天，但教会另一个人用扳手，这门手艺就不会断。'],s.game.builder?.level>=4);
  add('inheritance_retired','inheritance','后来者的字迹',['褪色的碳素墨水旁，添了一行歪扭却用力的新字迹。','有人接过了熬夜的值班表，有人接过了锈死难开的闸阀。工坊并未因某一个人的离开而熄灯。'],p.craft?.retired!==null&&p.craft?.retired!==undefined||c.course?.craftsman);
  add('inheritance_office','inheritance','不必认得每一个人',['领料台的公簿上，陆续出现了你从未见过的生疏签名。','人们依循贴在墙上的明约领料、检修、交班。这个共同体，终于不必再苦苦等待某个英雄归来。'],c.city?.institutions?.home.enabled||c.polity?.foundedAt);
  add('mutation_tracks','mutation','灰壳的路径',['铁灰色的硬壳甲虫沿着余热未散的焦土爬行。巡护员在防水本上记下裂缝走向、腐蚀灼伤与气压读数。','熬过漫长寒冬的活物，从不理会人类在图纸上标划的所谓管辖边界。'],exp?.beetles==='observed'||exp?.records.some(r=>r.kind==='beetle'));
  add('mutation_city','mutation','城外仍有土地',['城市规划员握着三角板，生平第一次将规整的农园与荒莽的野地划出清晰界限。','老农伸手按住了图纸，提醒道：地表径流、随风散播的孢子和夜行的兽群，读不懂这根铅笔线。'],Number.isSafeInteger(c.city?.cityAt));
  add('mutation_ecology','mutation','给生长留下空位',['土壤复原区中央特意留出一整片旷地：不播种，不平整，亦不施加任何化学干预。','曾有人斥其为荒谬的闲置；但化验记录证明，野生的蜂群、苔原渗滤水与漫长的时间，本就是这片土地的劳作者。'],f?.tech.restoration||g?.regions.rainforest?.acceptedAt!==null&&g?.regions.rainforest?.acceptedAt!==undefined);
  add('machine_switch','machines','仍在值守的开关',['锈蚀严重的重载继电器壳上，用尖锐物深深刻下了手动切断电闸的应急扳道位置。','昔日的检修员早已预料到：回路会自行嗡鸣运转下去，但下达指令的人类，却未必能活到明天。'],c.station&&c.tech.metal);
  add('machine_automation','machines','指令的主人',['自动机械臂能精准搬运、冷光焊接，也能毫无知觉地反复执行一道跨越半个世纪的荒诞死循环命令。','安全审查员在换班日志的签章栏工整署上自己的工号，坚决划掉了印刷体上的“系统默认指令”。'],f?.tech.automation);
  add('machine_person','machines','设备清单之外',[f?.created?'户籍官合上笨重的固定资产台账，将拥有自决意识的机械躯体，正式抄录进定居居民名册。':'全域议事厅既为生产性机械保留了固定的资产编号，也设立了一套审慎研判硅基自治人格的严格法条。','谁能作证，谁能申诉，谁承担错误——这些沉重的伦理命题，绝不能简单推给一个继电器开关。'],f?.assets.hall&&f?.tech.automation);
  add('echo_boundary','echo','战场的残余带宽',['接收器只在旧战场近旁捕获到短促的杂波；离开后，信号很快失真。','那不过是战时神经共鸣链路被高温熔结后的随机脉冲回音。那里既无战略物资，亦无神谕式的启示，更无全知全能的冷眼旁观者。'],f?.tech.echo);
  add('echo_choice','echo','没有完整的命令',[CivilFutureContent.echoes[f?.echo?.choice]?.text||'三份残存记录里，同一次撤离留下了相互矛盾的指令。','档案员在发脆的纸带边缘用铅笔加注：未解之悬案，亦当原样存真，永不覆写。'],f?.echo?.choice);
  add('echo_followup','echo','接收者的后来',[f?.echo?.choice==='exploit'?'有人仍需接受随访。那些艰难取得的技术资料，从未抵销接收信号时承受的伤害。':f?.echo?.choice==='seal'?'打上铅封的地下掩体大门，仍由普通地表巡护队员按日扫雪除锈。坑道内的死寂，从不代表那段惨剧未曾降临。':'历史调查组顶住压力，拒绝将相互撕裂的战事残片，人工脑补缝合成一份逻辑自洽的“确定命令”。','档案的边界止步于地表真实的泥泞与焦土，绝不为复兴中的共同体虚构任何通向救赎的超自然捷径。'],f?.echo?.visits>=3||f?.echo?.choice==='seal'&&f.echo.stage==='complete');
  add('mars_schedule','mars','表格上的另一颗星',['货场生锈的调度白板上，褪色的终点站仍写着“火星”。','在烈火焚尽电离层之前，那曾是一代代拓荒者离家远征、亦或载誉返乡的航线星图。'],c.station);
  add('mars_gap','mars','撤离之前的天气',[exp?.sites.ruin.state==='preserved'?'打孔纸带上的最后一串电传明码写着：轨道补给中断，全员撤离。':'各地防空洞起获的残存日志中，字里行间充斥着对天幕轨道补给彻底断绝的窒息记录。','究竟是谁先违约，不同阵营的密档留下了截然相反的记述。在这片废墟之上，没有任何一纸泛黄的文件，配得上替所有枉死者做最后的定罪证词。'],exp?.sites.ruin.state==='preserved'||g?.tech.mapping);
  add('mars_orbit','mars','向外发送的第一句话',['新测控站的天线缓缓转动，对准了幽暗的星空。','电波划破电离层，首先播发的唯有地表和平呼号与近地安全航道坐标，未带半句审判或复仇宣战。幽暗的星海深处是否仍有幸存的人耳在倾听，至今未得到证实。'],g&&CivilEarthFlight.done(g,'probe'));
  add('flight_drawings','flight','从地面开始的飞行',['总工程师摊开粗糙的再生网格纸，将低地居住聚落的供水管线、地热电网与近地轨道器的逃逸返航曲线，一笔一画勾勒在了同一张蓝图上。','脱离地表引力，并不意味着能将废墟上的责任一笔抹去。'],g?.unity);
  add('flight_closed','flight','关上舱门之前',['密闭舱测试的值班日志上，详细列着水粮、空气滤芯、应急注射剂与备用零件。','每一克补给皆出自地面工坊的实有人力；每一次气密中断，都详实记下了归责人与原因。'],g?.ground?.completedAt);
  add('flight_window','flight','舷窗另一侧',[g?.ending?.crew.total?'三层耐压舷窗内映出乘员的面孔。地底聚落始终为他们保留着返航后的床位与名籍。':'无人先遣器没有心跳。它向地表回传的遥测曲线，静默等待着未来真正登船的人。','这一趟近地轨道的收束，不过是在这颗结痂的星球表面，轻轻推开了一扇未锁的门。'],g?.ending);
  return out;
 },
 stages(s){const c=s.civilization;return [
  ['village','屋里多了几双鞋',['漫长冻夜里，壁炉旁终于有了轮班添柴的守火人。','门边泥泞的鞋履没有一双合脚，鞋底磨得斑驳，却属于活下来的人。','明早的口粮需要重新称量，墙角空着的木板床，不知道深夜还会迎来哪位过客。'],c.settled],
  ['town','从名字到地址',['泥泞的路口钉上了第一块用废铁皮敲出的固定门牌。','口信与运单可以精准投递到一处处所，不再全凭在人群中碰运气呼喊某个人的名字。','夜校的识字班、避难所诊室与平整的泥碎路，所要求的契约远比凑合吃一顿晚饭更为长久。'],c.village?.town],
  ['city','窗外不再只有森林',['第一批街区户籍纸页，用粗麻绳端正装订成了薄册。','排干沼气的农田与铸件工坊各有交接班次；净化水与消炎药的配额，再也不能只顾着原住民的份子。','你开始决定谁先得到新的能力，也决定谁暂时承担等待。'],Number.isSafeInteger(c.city?.cityAt)],
  ['cluster','另一座城的清晨',['列车卸下货箱，箱体上印着异地陌生的铅封印记。','有人随车捎来了带机油印的抢修账单，也有人附上一封言辞审慎的联盟联席议案。','全域公共财政簿上首次出现尖锐的质询：为何开支由本城据实核扣，而物资却调拨给百里外的外邦率先取用。'],c.conurbation?.clusterAt],
  ['nation','远处有人回答',CivilModernContent.eras.middle.lines,c.polity?.foundedAt],
  ['advanced','同一张生活账单',['有人换上新的关节，有人选择保留原来的身体。','水培农园与精密车床在同一个街区共存，各安其分。','技术的更迭从未有权代任何人决定怎样活着，却逼迫文明必须把彼此的权利边界一笔一画写得更加分明。'],c.polity?.future],
  ['earth','海另一边的天气',['各大区的无线电呼号，按时刻表逐一编入了同一份全球值守通信名录。','每一个聚落依然深深刻印着各自历经浩劫的伤疤、方言与顽固习惯。','共同法典学会了架设横跨大洋的航线，也学会了在敲开他人家门前，恪守克制地停下脚步。'],c.polity?.earth],
  ['flight','火光映在舷窗上',CivilModernContent.eras.late.lines,c.polity?.earth?.ending]
 ].map(([id,title,lines,ready])=>({id,title,lines,ready:!!ready}));},
 milestones(s){const c=s.civilization;return [
 ['fire','第一夜的温暖',s.game.fire?.value>=3],['settled','给后来人留一张床',c.settled],['trip','带着记录回来',c.expedition?.records.some(r=>r.kind==='trip')],['town','一条有名字的街',c.village?.town],['city','万人共同生活',Number.isSafeInteger(c.city?.cityAt)],['network','另一座城的承诺',c.conurbation?.clusterAt],['teaching','后来者能够接班',Object.values(c.city?.institutions?.wards||{}).some(w=>w.courses?.length)],['nation','写下共同国约',c.polity?.foundedAt],['future','能力成为日常',c.polity?.future?.stable>=600],['person','设备名册之外',c.polity?.future?.created>0&&c.polity.future.laws.citizenship==='equal'],['earth','同一颗地球',c.polity?.earth?.unity],['flight','重返太空',c.polity?.earth?.ending]
 ].map(([id,title,ready])=>({id,title,ready:!!ready}));},
 tick(s){if(!this.enabled(s))return;this.init(s);const c=s.civilization,d=c.archives;for(const a of this.nodes(s))if(a.ready&&d.records[a.id]===undefined)d.records[a.id]=c.elapsed;for(const a of this.milestones(s))if(a.ready&&d.achievements[a.id]===undefined)d.achievements[a.id]=c.elapsed;
  // The era handoff already provides these two openings: do not show a duplicate modal.
  if(c.modern?.eras.middle&&d.stages.nation===undefined)d.stages.nation=c.modern.eras.middle.at;
  if(c.modern?.eras.late&&d.stages.flight===undefined)d.stages.flight=c.modern.eras.late.at;
 },
 nextEvent(s){if(!this.enabled(s))return null;const d=s.civilization.archives;return d&&this.stages(s).some(a=>a.ready&&!['nation','flight'].includes(a.id)&&d.stages[a.id]===undefined)?'story_stage':null;},
 event(id,done){if(id!=='story_stage'||!this.nextEvent(State))return null;const s=State,d=s.civilization.archives,a=this.stages(s).find(a=>a.ready&&!['nation','flight'].includes(a.id)&&d.stages[a.id]===undefined);return {title:a.title,text:a.lines,buttons:{continue:{text:'把这一页留在记录里',nextScene:'end',onChoose:done(a.title+'。',()=>{d.stages[a.id]=s.civilization.elapsed;})}}};},
 history(s){const d=s.civilization.archives,out=[];for(const a of this.nodes(s))if(d?.records[a.id]!==undefined||!d&&a.ready)out.push({key:'archive_'+a.id,category:'archives',title:this.chains[a.chain]+' · '+a.title,detail:a.lines.join('\n'),at:d?.records[a.id]??null});for(const a of this.milestones(s))if(d?.achievements[a.id]!==undefined||!d&&a.ready)out.push({key:'achievement_'+a.id,category:'achievements',title:a.title,detail:'唯有切实履约达成的历史事件方得载入编年，不设虚拟通胀或探索奖励。',at:d?.achievements[a.id]??null});for(const a of this.stages(s))if(d?.stages[a.id]!==undefined)out.push({key:'opening_'+a.id,category:'archives',title:a.title,detail:a.lines.join('\n'),at:d.stages[a.id]});return out;},
 chronicle(s){const c=s.civilization,entries=CivilHistory.snapshot(s).entries.filter(x=>['cities','projects','technology','governance','tenures','people','archives','nation','expedition'].includes(x.category));return entries.map(e=>({...e,at:e.at??(e.from!==undefined?e.from*600:null)})).sort((a,b)=>(a.at??Infinity)-(b.at??Infinity));},
 openScroll(s=State){if(!s.civilization.polity?.earth?.ending||Events.activeEvent())return false;const text=this.chronicle(s),groups=[['火与最初的名字',0],['电与共同生活',s.civilization.modern?.eras.early?.at??s.civilization.city?.cityAt??0],['地区与国家',s.civilization.polity.foundedAt],['先进社会与地球',s.civilization.polity.future.at]],lines=[];for(let i=0;i<groups.length;i++){const [title,start]=groups[i],end=groups[i+1]?.[1]??Infinity;lines.push('—— '+title+' ——',...text.filter(e=>e.at!==null&&e.at>=start&&e.at<end).map(e=>'重建'+Math.floor(e.at/600)+'年 · '+e.title+'\n'+e.detail));}const undated=text.filter(e=>e.at===null);if(undated.length)lines.push('—— 旧记录未记年份 ——',...undated.map(e=>e.title+'\n'+e.detail));Events.startEvent({title:'文明回顾',civilHistory:true,scenes:{start:{text:lines,buttons:{close:{text:'合上长卷',nextScene:'end'}}}}},{width:600});Events.eventPanel().addClass('civil-history-event civil-chronicle');return true;},
 refresh(s){if(!$('#earthHistory').length||!s.civilization.polity?.earth?.ending)return;if(!$('#civilChronicle').length)CivilCityView.button('civilChronicle','翻开文明回顾长卷','#earthWorkbench',null,()=>this.openScroll(State)).insertAfter('#earthHistory');},
 validate(s){const d=s.civilization.archives;if(!this.enabled(s)){if(d!==undefined)throw Error('档案版本不符');return;}if(!d||d.schema!==1)throw Error('档案结构无效');for(const [field,defs]of [['records',this.nodes(s)],['stages',this.stages(s)],['achievements',this.milestones(s)]]){if(!d[field]||typeof d[field]!=='object'||Array.isArray(d[field]))throw Error('档案分类无效');for(const [id,at]of Object.entries(d[field]))if(!defs.some(a=>a.id===id)||!Number.isSafeInteger(at)||at<0||at>s.civilization.elapsed)throw Error('档案时序无效');}}
};
