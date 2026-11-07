# 《战后文明》文案导出与导入说明

本文件给研发和接手的 AI。润色者先看《给Gemini的润色提示词.md》，再编辑完整文稿或分卷。收到“导出文案”或“导入改稿”时先读本文件。

2026-11-07：Gemini 回稿已收回并逐项导入。桌面五份合卷 RTF（第1—24卷）、Cohub 的19份 Markdown（第20卷修正尾稿及第25—42卷）、原始导出基线和来源哈希均保存在 `历史版本/2026-11-07_Gemini交回稿/`。第20卷以 Cohub 第136—250条续稿修正桌面错误尾段。当前完整稿／分卷已更新为导入后的源码基线；11月6日 ZIP 仅作历史交付，不是当前文案。

本次采纳2961条，2542条直接写入显示源文案，419条涉及历史回执／幂等状态，通过 `游戏/content/editorial.js` 的406组去重显示映射呈现；账本原始值不改。保留最近的首页“进入世界”、阶段导航与统一科技图谱。详细取舍和验收见 `验证/Gemini文案导入_验收.md`、`验证/Gemini文案导入/逐条审阅.json`。

2026-11-07补充：按作者要求，文明回顾条目只呈现年份与正文，移除中间标题和分隔点。仅变更显示拼接，档案叙述、旧回执和Gemini原件不改；当前文稿已同步。

## 1. 版本与交付物

<!-- export-meta-start -->
- 导出时间：2026-11-07 18:03:29（北京时间）
- 源码提交：`5e4da8ac29ee396cdc5949aff837cc11e653c114`
- 文案：10305 条；分卷：47；静态数值：1971 项。
<!-- export-meta-end -->

- `作品完整文案.md`：全量中文文案、动态模板、界面文字、原作旧译与错误说明。不是一本道线性剧本。
- `分卷/`：与完整稿完全同源的分批稿，每卷最多250条；默认只改分卷或完整稿其中一套。
- `给Gemini的润色提示词.md`、`阅读顺序.md`：供外部文字编辑使用。
- `数值与规则参考.md`：内容表中的静态数值，只核对，不在润色任务中调整。
- `_导出基线/作品完整文案.md`、`_导出基线/分卷哈希.json`：导出时的原样正文与附件哈希，不手改。
- `文案定位.json`：逐条来源、UTF-16字符范围、原文、原文哈希、源文件哈希、语义锚点、语法树路径及动态变量表达式。
- `数值定位.json`：静态内容参数与扫描到的所有JavaScript数字字面量，含内部索引、版本、算法常量。不是都可用于调平衡。
- `导出校验.json`：来源清单、覆盖计数、分卷标记范围与源文件哈希；每次重新导出自动更新。
- `历史版本/`：覆盖前留存的完整稿；收到改稿时另外备份原始交回文件，不能覆盖原件。
- `战后文明_Gemini润色包_2026-11-06.zip`：本次便携文字包，不包含研发定位、旧存档、API密钥、源码或开发验证日志。ZIP是本次交付快照，后续重新导出时须另行重新打包，不自动更新。

文案目录在工程根目录，位于游戏静态根目录之外，不进入游戏构建或平台发布包。运行游戏仍无运行时npm依赖；导出工具使用锁定版本的Acorn与parse5开发依赖。

## 2. 来源与分组

按求生／近郊、城镇、城市群、地区国家、先进社会、地球首航、通用界面排列。当前新规则和历史兼容规则的源文案都保留；“源码中存在”不等于“当前新档必然显示”。兼容表中的星际或原作称谓不可据此加入当前主线。

完整逐文件清单在文末，也单独提供 `来源清单.md`。内容表中的一项科技通常包含名称、新能力、生活变化、取舍、退出的旧操作；动态页面和告警则来自 `src/postwar/`。原生ADR词库单列，不把英文查询键当作第二份中文正文。

## 3. 标记、边界与定位

### 3.1 每条正文

格式：`【类型】<!-- @cw.稳定标记 -->`，下面是可编辑原文。范围到下一个【类型】标记、小标题或说明引用块为止。`> 说明：`是编辑辅助信息，不是游戏台词；`> 批注：`是润色者给研发的建议，不进入游戏。

类型包括：叙述与说明、界面文字／名称／说明、选项、系统提示、完成提示、内容说明、科技的新能力／生活变化／取舍／退出旧操作、动态文本、旧版译文、原生调用·待核对、测试入口文字、错误校验、账目键名。标签只帮助阅读，不自动推断人物说话人或游戏效果。

标记是“文件＋语义锚点＋原始源码片段＋同处重复序号”的SHA-256短摘要。**不能把标记直接反算成行号**；到 `文案定位.json.records` 按 `id` 查对应项。定位同时保留 `anchor / astPath / originalHash / sourceHash / start / end / line`，不只依赖数组下标。正文文本在源码修改后可能产生新标记，导入时始终使用这一轮保留的基线和映射。

字符范围使用JavaScript UTF-16，左闭右开，不是UTF-8字节位置。HTML属性记录覆盖整个属性，JSON记录带原始引号；不可直接拿整条润色文本替换原始范围。需要保持字符串转义、引号、标签和表达式语义。

### 3.2 动态句与条件分支

- 固定字符串拼接被整理为带 `{变量1}`、`{分支2}`、`{列表3}` 的模板。各变量对应表达式在该条的 `variables` 中，润色者必须保留原样。
- 未知表达式和数值运算不执行，不用构造人口或假资源填句子。算术子表达式保持为一个变量，不能拆成两个数字贴在一起。
- 条件分支里的固定文字另有条目；可能只是一截补句，不可强行补出新的事件事实。分支的判断仍以代码为准，本稿不伪造解锁顺序、跳转或数值效果。
- 原作翻译的 `{0}`、`{1}` 等参数原样保留，不能转成汉字编号或删除。
- 某些中文短词同时是账目键或查找键，专门放在技术键名部分。改名必须检查读写、历史回放与存档兼容，不可只换显示端。
- `numericContentRows` 对应数值参考表；程序数字定位包含更多内部常量。公式、上下限和分支判断应回源文件审核，不从一段润色稿推导玩法。

### 3.3 样式与完整性

**历史回执的特别约定：** `content/editorial.js` 的 `source` 是兼容匹配键，不能润色；`text` 才是玩家看到的文案。导出把两组分段各自还原为完整句，类型为 `display-template`，变量位置在 `displaySlots`、分段在 `displayParts`，不伪造源码变量表达式。旧模型文件中标为“历史回执原文·只读”的条目也保持原样。`CivilEditorial` 只在文字、提示和读屏标签呈现时替换；表单输入、代码块、原生导出内容与账本校验不经过替换。后续调整必须继续验旧账回放及动态变量，不在历史原文上直接全局替换。

HTML字面量以可读文字和可读属性呈现，源码标签保存在映射中。实体已解码；实际换行保留为换行。文稿不暴露CSS选择器或JavaScript表达式。导入时若要合并动态片段，应逐句调整代码，重新验证，不做无条件字符串替换。

仅用于HTML类名、位置、元素标识或状态属性的变量不进入可读正文，仍完整保存在来源映射；正文中的可见变量必须保留。自检会单独统计这两类，不把删去样式标记当成漏导台词。

相同原文出现在不同文件／场景时各保留标记，这是来源不同，不是重复导出。完整稿与分卷是两套视图，不能把它们当成两批独立更改同时重复应用。

## 4. 导出与自检

```sh
cd 游戏
npm ci --ignore-scripts
npm run copy:export
```

Windows可使用 `npm.cmd`。导出脚本是 `游戏/tools/export-copy.mjs`，只读游戏源文件，不载入或运行世界、不改存档。需要临时比较当前源码时：

```sh
npm run copy:export -- --out /临时目录/战后文明文案
```

相对路径按当前命令目录解析。外部润色尚未收回时，保留已交付的基线与映射，把新导出放其他目录，以便三方比较。

脚本用语法树遍历 `content/`、`src/postwar/`、`script/`，补上简体翻译表、HTML文本／属性／内联脚本、CSS生成文字、测试入口与音频目录文字。中文字符串和模板片段必须全部归属到一条正文；一个来源片段只能归属一次。导出失败会报告缺口。可见纯英文标签和缺少翻译的原生调用也保留。

重新导出前会检查完整稿与基线，以及全部受管理分卷和数值附件的哈希。发现改动时拒绝覆盖；不要绕过保护。先备份，再由用户决定先导入还是另存新稿。导出前自动留存旧完整稿，并只清理它自己上次生成、且确认未被修改的分卷。

自检命令：`node tools/check-copy-export.mjs`。检查来源哈希／原文范围、正文标记与分卷一一对应、文本内容、占位符、旧原件哈希，以及重复导出标记稳定和“未导入稿禁止覆盖”。只校验导出流程，不称为游戏全量回归。

## 5. 导入改稿：由AI审阅，不做固定转换器

1. 先保存润色者原稿到 `历史版本/日期_交回稿/`。若只收到分卷，不自行补写其他卷的“润色版”。
2. 用本次基线／映射比较改稿，列出新增、删除、文字、占位符和数字变化。若源码也已改动，另外导出到临时目录，三方比较；保留双方修改，含糊冲突先讨论。
3. 按标记查映射，再核对当前源码和原文。源码哈希不同就不能沿旧字符范围机械替换。标记丢失时结合语义锚点、上下文和原句匹配，不靠同文全局替换。
4. 普通文辞逐项写回对应源数据；动态模板保留分支、算式、类型、空格边界、HTML转义和所有占位符。修改账目键、同名多处术语、数值、前置、选项效果或世界观时逐项审核；与润色授权无关的玩法变更先讨论。
5. 运行相关测试、原生存取检查和有代表性的页面。按钮、标题和说明变长时复核1920／1280／853／390布局、暗色与弹窗滚动；游戏历史导出只读。
6. 再导出到临时目录，对照改稿确认所有已接受更改都落地。批注和未采纳项单列，不误当游戏正文。
7. 完成后才刷新正式文稿和基线、更新HANDOFF和变更记录。不写永久的一键导入脚本；本稿不是可执行的迁移文件。

## 6. 范围与未收录内容

- 已收录：上述游戏源码中的中文文案／分支片段、可识别的可见英文、全部简体中文词库、页面按钮／标题／说明、存档与声音菜单、科技／政策／社会制度、档案与结局、测试入口、可能暴露给玩家的错误校验。
- 数值：内容表的静态数值另有可读表，扫描范围中所有JavaScript数字字面量另有研发定位；运行中的人口、库存、日期和动态公式不是润色正文，保留占位符并登记表达式。
- 不收录：其他语种的同源翻译、第三方库内部错误、代码注释／开发文档、测试夹具／验收日志、历史存档已发生的叙述快照、布局尺寸／图形点阵／纯分隔符、图片内的字、音频与生成提示词。它们不进入本轮语言润色；图片文字若将来要改，单独改素材。
- 此覆盖是静态源码盘点，不是每一分支的自然试玩证明。兼容与不可达原作内容保留供定位，默认低优先级。

## 7. 变更记录

- 2026-11-07：收回42卷交回稿，审阅2973处差异；采纳2961条，另12处保留原文或现行界面。桌面第20卷的72个异常标记不写入游戏，使用Cohub修正续稿覆盖对应合法标记。对供暖／道路误配、粮水“或／且”、退任／去世、一次性费用／利息和动态片段错配作人工修正。刷新文案与来源映射；原稿、旧基线另存，未创建永久导入器。

- 2026-11-06：首次导出，按用户要求供Gemini润色；建立完整稿、分卷、动态模板、数值参考、来源映射、基线与覆盖校验。游戏文案与玩法尚未修改，未把内容发送给外部模型。

## 8. 逐文件对应清单

<!-- export-sources-start -->
|来源|是否由正式入口直接加载|文案条目|用途|
|---|---|---:|---|
|`游戏/content/accession.js`|是|0|地区接纳|
|`游戏/content/advanced.js`|是|37|复兴后期设施|
|`游戏/content/aftermath.js`|是|5|停火与重建|
|`游戏/content/city.js`|是|17|城市经营|
|`游戏/content/commerce.js`|是|3|商贸|
|`游戏/content/congress.js`|是|0|联盟会议|
|`游戏/content/corridor.js`|是|0|运输走廊|
|`游戏/content/development.js`|是|48|复兴科技|
|`游戏/content/earth.js`|是|58|地球共同法|
|`游戏/content/editorial.js`|是|812|历史回执与显示文案|
|`游戏/content/expedition.js`|是|26|近郊出行与遗迹|
|`游戏/content/finance.js`|是|1|互助与财政|
|`游戏/content/foreign.js`|是|5|国家自主交涉|
|`游戏/content/frontier.js`|是|2|开拓|
|`游戏/content/future.js`|是|116|先进社会|
|`游戏/content/industry.js`|是|40|工业与岗位|
|`游戏/content/intercity.js`|是|0|城际接续|
|`游戏/content/leagues.js`|是|5|联盟与退出|
|`游戏/content/markets.js`|是|3|自主市场|
|`游戏/content/modern.js`|是|48|电与通信|
|`游戏/content/municipal.js`|是|15|地方公共工程|
|`游戏/content/origins.js`|是|3|幸存者来源|
|`游戏/content/partnership.js`|是|0|地区伙伴|
|`游戏/content/passenger.js`|是|2|迁居运输|
|`游戏/content/precision.js`|是|16|精密制造|
|`游戏/content/railway.js`|是|5|轨道运输|
|`游戏/content/regions.js`|是|21|周边地区|
|`游戏/content/security.js`|是|9|守备|
|`游戏/content/services.js`|是|22|公共服务|
|`游戏/content/settlement.js`|是|8|聚居与收容|
|`游戏/content/space.js`|是|31|航天旧制|
|`游戏/content/statecraft.js`|是|25|国家利益|
|`游戏/content/transit.js`|是|3|贸易中转|
|`游戏/content/urban.js`|是|22|城镇建设|
|`游戏/content/worldstage.js`|是|39|地球地区旧制|
|`游戏/content/zh.js`|是|84|开局、基础术语与时代措辞|
|`游戏/src/postwar/accession.js`|是|38|地区接纳|
|`游戏/src/postwar/adapter.js`|是|150|共同体日常与进度提示|
|`游戏/src/postwar/advanced.js`|是|5|复兴后期设施|
|`游戏/src/postwar/aftermath.js`|是|86|停火与重建|
|`游戏/src/postwar/archives.js`|是|138|档案、里程碑与文明回顾|
|`游戏/src/postwar/census.js`|是|40|世界人口底账|
|`游戏/src/postwar/city-budget-validation.js`|是|7|城市经营·公共预算·校验|
|`游戏/src/postwar/city-budget-view.js`|是|32|城市经营·公共预算·界面|
|`游戏/src/postwar/city-budget.js`|是|36|城市经营·公共预算|
|`游戏/src/postwar/city-continuity-validation.js`|是|35|城市经营·代际补员·校验|
|`游戏/src/postwar/city-continuity-view.js`|是|52|城市经营·代际补员·界面|
|`游戏/src/postwar/city-continuity.js`|是|37|城市经营·代际补员|
|`游戏/src/postwar/city-council-validation.js`|是|67|城市经营·共同委托·校验|
|`游戏/src/postwar/city-council-view.js`|是|143|城市经营·共同委托·界面|
|`游戏/src/postwar/city-council.js`|是|61|城市经营·共同委托|
|`游戏/src/postwar/city-dispatch-validation.js`|是|20|城市经营·货运调度·校验|
|`游戏/src/postwar/city-dispatch-view.js`|是|30|城市经营·货运调度·界面|
|`游戏/src/postwar/city-dispatch.js`|是|24|城市经营·货运调度|
|`游戏/src/postwar/city-governance-validation.js`|是|21|城市经营·城市治理·校验|
|`游戏/src/postwar/city-governance-view.js`|是|30|城市经营·城市治理·界面|
|`游戏/src/postwar/city-governance.js`|是|18|城市经营·城市治理|
|`游戏/src/postwar/city-homes-validation.js`|是|42|城市经营·住房与迁居·校验|
|`游戏/src/postwar/city-homes-view.js`|是|53|城市经营·住房与迁居·界面|
|`游戏/src/postwar/city-homes.js`|是|40|城市经营·住房与迁居|
|`游戏/src/postwar/city-institutions-view.js`|是|60|城市经营·机构职责·界面|
|`游戏/src/postwar/city-institutions.js`|是|37|城市经营·机构职责|
|`游戏/src/postwar/city-labor-skills.js`|是|5|城市经营·岗位与工资·技能培训|
|`游戏/src/postwar/city-labor-validation.js`|是|36|城市经营·岗位与工资·校验|
|`游戏/src/postwar/city-labor-view.js`|是|65|城市经营·岗位与工资·界面|
|`游戏/src/postwar/city-labor.js`|是|46|城市经营·岗位与工资|
|`游戏/src/postwar/city-map.js`|是|73|城市经营·补充|
|`游戏/src/postwar/city-network-view.js`|是|112|城市经营·跨城物流·界面|
|`游戏/src/postwar/city-network.js`|是|96|城市经营·跨城物流|
|`游戏/src/postwar/city-registry-view.js`|是|27|城市经营·人口登记·界面|
|`游戏/src/postwar/city-registry.js`|是|20|城市经营·人口登记|
|`游戏/src/postwar/city-view.js`|是|142|城市经营·界面|
|`游戏/src/postwar/city.js`|是|34|城市经营|
|`游戏/src/postwar/civic.js`|是|230|补充|
|`游戏/src/postwar/clock.js`|是|2|时间|
|`游戏/src/postwar/commerce.js`|是|64|商贸|
|`游戏/src/postwar/congress.js`|是|58|联盟会议|
|`游戏/src/postwar/conurbation-view.js`|是|136|真实城市接入·界面|
|`游戏/src/postwar/conurbation.js`|是|63|真实城市接入|
|`游戏/src/postwar/cooperative.js`|是|48|合作社|
|`游戏/src/postwar/corridor.js`|是|26|运输走廊|
|`游戏/src/postwar/course.js`|是|63|公共与工业路线|
|`游戏/src/postwar/culture.js`|是|28|文化与共同生活|
|`游戏/src/postwar/decisions.js`|是|1|早期抉择|
|`游戏/src/postwar/diplomacy.js`|是|31|外交|
|`游戏/src/postwar/domain-validation.js`|是|36|地区共同职责·校验|
|`游戏/src/postwar/domain-view.js`|是|69|地区共同职责·界面|
|`游戏/src/postwar/domain.js`|是|36|地区共同职责|
|`游戏/src/postwar/earth-flight.js`|是|51|地球共同法·首航与返航|
|`游戏/src/postwar/earth-view.js`|是|145|地球共同法·界面|
|`游戏/src/postwar/earth.js`|是|78|地球共同法|
|`游戏/src/postwar/editorial.js`|是|0|历史回执与显示文案|
|`游戏/src/postwar/equipment.js`|是|34|装备与护送|
|`游戏/src/postwar/expedition.js`|是|188|近郊出行与遗迹|
|`游戏/src/postwar/finance.js`|是|68|互助与财政|
|`游戏/src/postwar/forecast.js`|是|0|预报|
|`游戏/src/postwar/foreign.js`|是|92|国家自主交涉|
|`游戏/src/postwar/frontier.js`|是|68|开拓|
|`游戏/src/postwar/future-echo.js`|是|10|先进社会·回响调查|
|`游戏/src/postwar/future-people.js`|是|8|先进社会·居民身体与身份|
|`游戏/src/postwar/future-view.js`|是|154|先进社会·界面|
|`游戏/src/postwar/future.js`|是|110|先进社会|
|`游戏/src/postwar/generations.js`|是|35|人物与机构接续|
|`游戏/src/postwar/guide.js`|是|151|下一步指引|
|`游戏/src/postwar/hearth.js`|是|37|炉火管理|
|`游戏/src/postwar/heating.js`|是|29|供热|
|`游戏/src/postwar/history.js`|是|344|发展史|
|`游戏/src/postwar/incidents.js`|是|41|日常与随机事件|
|`游戏/src/postwar/industry.js`|是|29|工业与岗位|
|`游戏/src/postwar/intercity.js`|是|44|城际接续|
|`游戏/src/postwar/interface.js`|是|184|建造与科技界面|
|`游戏/src/postwar/landing.js`|是|2|补充|
|`游戏/src/postwar/leagues.js`|是|99|联盟与退出|
|`游戏/src/postwar/local-saves.js`|是|57|本地·存档槽|
|`游戏/src/postwar/markets.js`|是|32|自主市场|
|`游戏/src/postwar/metro.js`|是|59|城市群旧制|
|`游戏/src/postwar/modern.js`|是|63|电与通信|
|`游戏/src/postwar/municipal.js`|是|130|地方公共工程|
|`游戏/src/postwar/nation.js`|是|44|建国旧制|
|`游戏/src/postwar/origins.js`|是|116|幸存者来源|
|`游戏/src/postwar/pacing.js`|是|34|轮值委托与发展抉择|
|`游戏/src/postwar/partnership.js`|是|46|地区伙伴|
|`游戏/src/postwar/passenger.js`|是|43|迁居运输|
|`游戏/src/postwar/planning.js`|是|17|生产计划|
|`游戏/src/postwar/platform.js`|是|61|导入导出与存档|
|`游戏/src/postwar/polity-foreign.js`|是|58|国家国约·国家自主交涉|
|`游戏/src/postwar/polity-validation.js`|是|14|国家国约·校验|
|`游戏/src/postwar/polity-view.js`|是|172|国家国约·界面|
|`游戏/src/postwar/polity.js`|是|35|国家国约|
|`游戏/src/postwar/population.js`|是|0|年龄与人口|
|`游戏/src/postwar/precision.js`|是|2|精密制造|
|`游戏/src/postwar/railway.js`|是|37|轨道运输|
|`游戏/src/postwar/readable.js`|是|204|状况卡与告警|
|`游戏/src/postwar/region-map.js`|是|58|补充·补充|
|`游戏/src/postwar/regional-validation.js`|是|42|地区经营·校验|
|`游戏/src/postwar/regional-view.js`|是|56|地区经营·界面|
|`游戏/src/postwar/regional.js`|是|57|地区经营|
|`游戏/src/postwar/regions.js`|是|170|周边地区|
|`游戏/src/postwar/relief.js`|是|12|救济|
|`游戏/src/postwar/ruins.js`|是|37|遗迹调查|
|`游戏/src/postwar/rules.js`|是|19|求生与生产|
|`游戏/src/postwar/save-codec.js`|是|7|补充·补充|
|`游戏/src/postwar/security.js`|是|38|守备|
|`游戏/src/postwar/services.js`|是|49|公共服务|
|`游戏/src/postwar/settlement.js`|是|81|聚居与收容|
|`游戏/src/postwar/setup.js`|是|18|新世界设定|
|`游戏/src/postwar/society.js`|是|110|制度与代际|
|`游戏/src/postwar/sound.js`|是|15|声音菜单|
|`游戏/src/postwar/space.js`|是|51|航天旧制|
|`游戏/src/postwar/statecraft.js`|是|67|国家利益|
|`游戏/src/postwar/tech-sources.js`|是|18|补充·补充|
|`游戏/src/postwar/tech-tree.js`|是|79|补充·补充|
|`游戏/src/postwar/transit.js`|是|84|贸易中转|
|`游戏/src/postwar/urban.js`|是|165|城镇建设|
|`游戏/src/postwar/village.js`|是|33|村镇生活|
|`游戏/src/postwar/wind.js`|是|11|寒潮|
|`游戏/src/postwar/worldstage.js`|是|81|地球地区旧制|
|`游戏/script/Button.js`|是|0|原生按钮|
|`游戏/script/audio.js`|是|0|原生声音|
|`游戏/script/audioLibrary.js`|是|0|原生声音清单|
|`游戏/script/dropbox.js`|否或经运行时使用|0|补充|
|`游戏/script/engine.js`|是|8|通用操作|
|`游戏/script/events.js`|是|8|原生事件|
|`游戏/script/events/encounters.js`|否或经运行时使用|4|补充|
|`游戏/script/events/executioner.js`|否或经运行时使用|190|补充|
|`游戏/script/events/global.js`|否或经运行时使用|0|补充|
|`游戏/script/events/marketing.js`|否或经运行时使用|5|补充|
|`游戏/script/events/outside.js`|否或经运行时使用|0|荒林与原镇|
|`游戏/script/events/room.js`|否或经运行时使用|0|维修间|
|`游戏/script/events/setpieces.js`|否或经运行时使用|0|补充|
|`游戏/script/fabricator.js`|是|24|原作制造|
|`游戏/script/header.js`|是|0|补充|
|`游戏/script/localization.js`|是|0|语言设置|
|`游戏/script/notifications.js`|是|0|消息记录|
|`游戏/script/outside.js`|是|6|荒林与原镇|
|`游戏/script/path.js`|是|4|原作行囊|
|`游戏/script/prestige.js`|是|1|原作继承|
|`游戏/script/room.js`|是|1|维修间|
|`游戏/script/scoring.js`|是|1|原作评分|
|`游戏/script/ship.js`|是|0|原作飞船|
|`游戏/script/space.js`|是|9|航天旧制|
|`游戏/script/state_manager.js`|是|0|状态管理|
|`游戏/script/world.js`|是|7|原作地图|
|`游戏/testing/hub.js`|否或经运行时使用|18|测试目录|
|`游戏/testing/session.js`|否或经运行时使用|32|测试副本|
|`游戏/lang/zh_cn/strings.js`|是|786|简体中文旧译|
|`游戏/index.html`|是|4|补充|
|`游戏/体验测试.html`|否或经运行时使用|29|补充|
|`游戏/browserWarning.html`|否或经运行时使用|18|补充|
|`游戏/mobileWarning.html`|否或经运行时使用|6|补充|
|`游戏/css/city.css`|否或经运行时使用|0|城市经营|
|`游戏/css/dark.css`|否或经运行时使用|0|补充|
|`游戏/css/fabricator.css`|否或经运行时使用|0|原作制造|
|`游戏/css/history.css`|否或经运行时使用|0|发展史|
|`游戏/css/interface.css`|否或经运行时使用|0|建造与科技界面|
|`游戏/css/layout.css`|否或经运行时使用|0|补充|
|`游戏/css/main.css`|否或经运行时使用|2|补充|
|`游戏/css/narrow.css`|否或经运行时使用|0|补充|
|`游戏/css/outside.css`|否或经运行时使用|0|荒林与原镇|
|`游戏/css/path.css`|否或经运行时使用|0|原作行囊|
|`游戏/css/postwar.css`|否或经运行时使用|0|补充|
|`游戏/css/region-map.css`|否或经运行时使用|0|补充·补充|
|`游戏/css/room.css`|否或经运行时使用|0|维修间|
|`游戏/css/ship.css`|否或经运行时使用|0|原作飞船|
|`游戏/css/space.css`|否或经运行时使用|0|航天旧制|
|`游戏/css/tech-tree.css`|否或经运行时使用|0|补充·补充|
|`游戏/css/world.css`|否或经运行时使用|0|原作地图|
|`游戏/lang/zh_cn/main.css`|否或经运行时使用|0|补充|
|`游戏/testing/catalog.json`|否或经运行时使用|145|测试节点|
|`游戏/audio/postwar/manifest.json`|否或经运行时使用|34|音乐目录|
<!-- export-sources-end -->
