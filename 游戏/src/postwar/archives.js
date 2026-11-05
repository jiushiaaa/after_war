/* MPL-2.0 — Adaptation fiction, revealed by real actions. These are not claims of novel canon. */
var CivilArchives={
 enabled(s){return s.civilization?.polishVersion===1;},
 init(s){if(this.enabled(s)&&!s.civilization.archives)s.civilization.archives={schema:1,records:{},stages:{},achievements:{}};},
 chains:{facilities:'谁留下这些设施',belonging:'谁属于共同体',inheritance:'谁接过这把火',mutation:'变异与生态',machines:'机群',echo:'回响',mars:'火星',flight:'首航'},
 nodes(s){const c=s.civilization,f=c.polity?.future,g=c.polity?.earth,exp=c.expedition,p=c.generations?.people||{},out=[];const add=(id,chain,title,lines,ready)=>out.push({id,chain,title,lines,ready:!!ready});
  add('facility_station','facilities','没有注销的班次',['候车厅的货运表停在最后一班。维修编号却比停航日期晚。','战后仍有人回来过，换过阀门，又把自己的名字擦掉。'],c.station);
  add('facility_pump','facilities','旁路上的手印',['断电的控制柜旁，有人另接了一条能手动打开的管道。','她没能留下完整机器，只留下后来人还修得动的部分。'],c.pump);
  add('facility_grid','facilities','把图纸交出去',['新电网验收时，档案员要求把接线图放在每一处服务所。','不是只有某一个人知道怎样让灯亮。'],c.modern?.modernRounds>=6||c.tech.power);
  add('belonging_ration','belonging','第一份口粮约定',['名册最初只有几个名字，空行比名字多。','有人问：下一位走进门的人，是否也在这份约定里？'],c.policy);
  add('belonging_mutant','belonging','没有单独一页',['一位变异居民把旧表格翻了过去。','他希望记录自己的职业、家人和住处，不只记录身体上的差异。'],p.mutant||c.society?.governed&&c.society.cohorts.some(x=>x.identity==='mutant'));
  add('belonging_citizen','belonging','一份能够离开的约定',['共同法留下迁徙、财产和申诉条款。','归属不只意味着被保护，也意味着能够拒绝某一项安排。'],c.polity?.foundedAt&&c.polity.laws.rights==='equal');
  add('inheritance_workshop','inheritance','工匠的桌面',['工匠把磨短的铅笔插在门框里。','她说，材料会用完，教会另一个人却不会。'],s.game.builder?.level>=4);
  add('inheritance_retired','inheritance','后来者的字迹',['旧笔迹旁添了另一种笔迹。','有人接过值班表，有人接过最难修的那一把锁。工坊没有因为一个人离开而熄灯。'],p.craft?.retired!==null&&p.craft?.retired!==undefined||c.course?.craftsman);
  add('inheritance_office','inheritance','不必认得每一个人',['公共记录里出现了你未曾见过的签名。','他们按公开的约定领料、维护和交接。共同体终于不必等待一个人回来。'],c.city?.institutions?.home.enabled||c.polity?.foundedAt);
  add('mutation_tracks','mutation','灰壳的路径',['甲虫沿着暖土爬行。你们留下路线、伤口和天气的记录。','活下来的东西并不都理解人类画的边界。'],exp?.beetles==='observed'||exp?.records.some(r=>r.kind==='beetle'));
  add('mutation_city','mutation','城外仍有土地',['城市规划者第一次把农园和野地分开画。','农人提醒他，水、孢子和迁徙的动物不会读那条线。'],Number.isSafeInteger(c.city?.cityAt));
  add('mutation_ecology','mutation','给生长留下空位',['恢复区里有一片土不收获，也不改造。','有人说这是浪费；农园记录却显示，花粉、净水与耐心也在参与生产。'],f?.tech.restoration||g?.regions.rainforest?.acceptedAt!==null&&g?.regions.rainforest?.acceptedAt!==undefined);
  add('machine_switch','machines','仍在值守的开关',['继电器外壳上刻着人工断开的位置。','旧维护员似乎预料过：机器会继续运行，而命令它的人不一定还在。'],c.station&&c.tech.metal);
  add('machine_automation','machines','指令的主人',['自动班组能搬运、焊接，也能重复一条已经不合时宜的命令。','监督者在交班时写下责任人，而不是写“系统已经决定”。'],f?.tech.automation);
  add('machine_person','machines','设备清单之外',[f?.created?'登记员把新自治人格从设备清单移入居民名册。':'议事厅保留了普通机器的设备编号，也留下判断自治人格的程序。','谁能作证，谁能申诉，谁承担错误——这些问题不能交给一个开关。'],f?.assets.hall&&f?.tech.automation);
  add('echo_boundary','echo','战场的残余带宽',['接收器只在旧战场近旁拾到碎片，离开后很快失真。','它来自战时神经联接项目的残余，没有物资，没有预言，也没有全知的观察者。'],f?.tech.echo);
  add('echo_choice','echo','没有完整的命令',[f?.echo?CivilFutureContent.echoes[f.echo.choice].text:'三份记录相互矛盾。','记录员在空白处写下：不知道，也必须被保存。'],f?.echo);
  add('echo_followup','echo','接收者的后来',[f?.echo?.choice==='exploit'?'有人仍需要随访。获得的知识没有抵销那段伤害。':f?.echo?.choice==='seal'?'封存的入口仍由普通巡护维护。安静不等于从未有人来过。':'研究者拒绝把相互矛盾的残片拼成一份确定命令。','档案停在地面，不为共同体打开一条超自然的捷径。'],f?.echo?.visits>=3);
  add('mars_schedule','mars','表格上的另一颗星',['货运表上的目的地仍写着火星。','在战争之前，那也曾经是回家和远行的方向。'],c.station);
  add('mars_gap','mars','撤离之前的天气',[exp?.sites.ruin.state==='preserved'?'纸带写着：轨道补给中断，全员撤离。':'收集到的地面记录反复提到轨道补给中断。','关于谁先失约，不同保管者留下了不同记述。没有一张纸足以替所有死者作证。'],exp?.sites.ruin.state==='preserved'||g?.tech.mapping);
  add('mars_orbit','mars','向外发送的第一句话',['新测控站校准了指向星空的天线。','这次发出的首先是呼号和航道信息，没有宣战书。远处是否有人接收，仍未得到证实。'],g&&CivilEarthFlight.done(g,'probe'));
  add('flight_drawings','flight','从地面开始的飞行',['工程师把居住、供电和返航画在同一张纸上。','能够离开地球，不等于可以把地上的责任留给空白。'],g?.unity);
  add('flight_closed','flight','关上舱门之前',['闭环试验的值班表上有食物、滤材、药物和维修件。','每一项都来自地面真实的劳动；每一次暂停都留下原因。'],g?.ground?.completedAt);
  add('flight_window','flight','舷窗另一侧',[g?.ending?.crew.total?'舷窗里映着实际乘员的身影。地面为他们保留着返航后的床位。':'先遣器没有常驻乘员。它传回地球的曲线，等待后来真正登船的人。','这次航行的结束，是地球篇留下的一扇门。'],g?.ending);
  return out;
 },
 stages(s){const c=s.civilization;return [
  ['village','屋里多了几双鞋',['夜里有了轮流守火的人。','门边的鞋没有一双相同。','明天的口粮需要安排，空下来的床还会等到谁。'],c.settled],
  ['town','从名字到地址',['路边开始出现固定的门牌。','消息可以送到一个地方，不必先找到某一个人。','课堂、诊所和共同的道路，要求比一顿晚饭更长的承诺。'],c.village?.town],
  ['city','窗外不再只有森林',['第一批街区名册装订成册。','田地与工坊各有班次，水和药不能只够原镇的人。','你开始决定谁先得到新的能力，也决定谁暂时承担等待。'],Number.isSafeInteger(c.city?.cityAt)],
  ['cluster','另一座城的清晨',['列车带来的货物有另一种包装。','有人寄来维修账单，也有人寄来一份新的邀请。','共同预算第一次需要解释：为什么由这里支付，却让那里先使用。'],c.conurbation?.clusterAt],
  ['nation','远处有人回答',CivilModernContent.eras.middle.lines,c.polity?.foundedAt],
  ['advanced','同一张生活账单',['有人换了新的关节，有人选择保留原来的身体。','农园和制造间仍在同一座城里。','新的能力没有替任何人决定生活，却使每一份权利更需要写清楚。'],c.polity?.future],
  ['earth','海另一边的天气',['八区的呼号逐渐进入同一张值班表。','每个地方都保留着自己的苦难和习惯。','共同法要学会跨过海洋，也要学会停在别人的门口。'],c.polity?.earth],
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
 history(s){const d=s.civilization.archives,out=[];for(const a of this.nodes(s))if(d?.records[a.id]!==undefined||!d&&a.ready)out.push({key:'archive_'+a.id,category:'archives',title:this.chains[a.chain]+' · '+a.title,detail:a.lines.join('\n'),at:d?.records[a.id]??null});for(const a of this.milestones(s))if(d?.achievements[a.id]!==undefined||!d&&a.ready)out.push({key:'achievement_'+a.id,category:'achievements',title:a.title,detail:'只记已经实际达成的里程碑，不发放资源或奖励。',at:d?.achievements[a.id]??null});for(const a of this.stages(s))if(d?.stages[a.id]!==undefined)out.push({key:'opening_'+a.id,category:'archives',title:a.title,detail:a.lines.join('\n'),at:d.stages[a.id]});return out;},
 chronicle(s){const c=s.civilization,entries=CivilHistory.snapshot(s).entries.filter(x=>['cities','projects','technology','governance','tenures','people','archives','nation','expedition'].includes(x.category));return entries.map(e=>({...e,at:e.at??(e.from!==undefined?e.from*600:null)})).sort((a,b)=>(a.at??Infinity)-(b.at??Infinity));},
 openScroll(s=State){if(!s.civilization.polity?.earth?.ending||Events.activeEvent())return false;const text=this.chronicle(s),groups=[['火与最初的名字',0],['电与共同生活',s.civilization.modern?.eras.early?.at??s.civilization.city?.cityAt??0],['地区与国家',s.civilization.polity.foundedAt],['先进社会与地球',s.civilization.polity.future.at]],lines=[];for(let i=0;i<groups.length;i++){const [title,start]=groups[i],end=groups[i+1]?.[1]??Infinity;lines.push('—— '+title+' ——',...text.filter(e=>e.at!==null&&e.at>=start&&e.at<end).map(e=>'重建'+Math.floor(e.at/600)+'年 · '+e.title+'\n'+e.detail));}const undated=text.filter(e=>e.at===null);if(undated.length)lines.push('—— 旧记录未记年份 ——',...undated.map(e=>e.title+'\n'+e.detail));Events.startEvent({title:'文明回顾',scenes:{start:{text:lines,buttons:{close:{text:'合上长卷',nextScene:'end'}}}}},{width:600});Events.eventPanel().addClass('civil-history-event civil-chronicle');return true;},
 refresh(s){if(!$('#earthHistory').length||!s.civilization.polity?.earth?.ending)return;if(!$('#civilChronicle').length)CivilCityView.button('civilChronicle','翻开文明回顾长卷','#earthWorkbench',null,()=>this.openScroll(State)).insertAfter('#earthHistory');},
 validate(s){const d=s.civilization.archives;if(!this.enabled(s)){if(d!==undefined)throw Error('档案版本不符');return;}if(!d||d.schema!==1)throw Error('档案结构无效');for(const [field,defs]of [['records',this.nodes(s)],['stages',this.stages(s)],['achievements',this.milestones(s)]]){if(!d[field]||typeof d[field]!=='object'||Array.isArray(d[field]))throw Error('档案分类无效');for(const [id,at]of Object.entries(d[field]))if(!defs.some(a=>a.id===id)||!Number.isSafeInteger(at)||at<0||at>s.civilization.elapsed)throw Error('档案时序无效');}}
};
