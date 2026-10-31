# 来源与修改说明

本工程直接基于 [A Dark Room 官方源码](https://github.com/doublespeakgames/adarkroom)。

- 上游基线：`1fada4620b6c66bd07bf15a3f1eb8223df8bc1d7`
- 原作者：Michael Townsend 及上游贡献者。
- 源码许可：MPL-2.0，完整文本保留于 `LICENSE.md`。
- 2026-11-01 起的本作修改：Engine 启动、菜单及存档；Button 统一时钟冷却；Room 计时取消接口；新增 `src/postwar/` 和 `content/`；入口本地依赖与统计移除。
- 原版房间/荒林、StateManager、Header、Notifications、Events、Button DOM、CSS、库存与职业布局继续使用。新内容通过 adapter 和数据目录扩展。
- 上游其他事件、世界与太空源码保留用于参考和后续改造，本作没有直接开放原版后期剧情；这些源码存在不构成本作玩法已完成的证据。

分发本工程的可执行版本时，应同时提供包括修改在内的对应可修改源码，保留本说明与 MPL-2.0 文本。不要把这份改编宣称为上游官方版本。

《这游戏也太真实了》内容改编依据用户提供的作者授权；已核实题材与本作新增设定分别见 `../设计/01_世界观来源与待核实项.md`。新文案不冒充原著原文或原著已核实年表。

村镇扩展新增 `content/development.js` 与 `src/postwar/village.js`，修改adapter/rules/platform及少量附加CSS；全部沿用本工程MPL-2.0来源约束。

代际与工业扩展新增 `src/postwar/society.js`、`content/industry.js` 和 `src/postwar/industry.js`，继续通过adapter接入原生地点、事件、建造、岗位和库存。修改platform存档校验、rules人口与产出计算，以及Room的新资源小数显示。规则测试与自然游玩存档位于 `tests/`；全部保留MPL-2.0。

地区与城市扩展新增 `content/regions.js`、`content/urban.js`、`src/postwar/regions.js`、`src/postwar/urban.js`，接入独立地区仓库、真实在途货物、共同服务与公民资格、有限来源迁入、公共设施、正式镇制及首城判定。Society新增真实育龄比例出生，adapter沿用原生事件与岗位接线并将镇制后的普通维修转为实付轮值。修改继续遵循MPL-2.0；没有开放上游原版太空结局。
