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
