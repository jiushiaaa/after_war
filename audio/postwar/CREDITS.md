# 《战后文明》声音来源

## 原创生成的音乐与环境声

本目录17条MP3使用火山引擎**豆包音频生成模型1.0（seed-audio-1.0）**，按用户授权生成，用于《战后文明》。没有上传游戏存档、项目正文或凭据作为素材。提示词与实际返回时长见 `manifest.json`、`seedaudio-records.json`；请求启用隐式AIGC元数据，原生成音频保留，不添加可听口播。

设计94的单项合计是36分钟。因[官方模型上限单条120秒](https://docs.volcengine.com/docs/doubao-voice/model-list?lang=en)，150/180秒BGM改为120秒生成，保持全部曲目与用途，播放时柔和循环。此次计划总时长28.5分钟；实际生成统计以记录与音频解码为准，不把循环次数算生成额度。

生成音乐/环境声不是ADR原版音乐，也不声称具有人工演奏或CC0来源。使用范围以用户的生成服务权益为准。

## 原版 A Dark Room 短音效

建造、制作、添火、采木、脚步、遭遇、武器与事件短音效复用本仓库 `audio/*.flac` 和 `script/audioLibrary.js` 中原有资源，来自 doublespeak games / A Dark Room 上游，沿用仓库 **MPL-2.0** 许可与原作者声明。参见仓库 `UPSTREAM.md` 和 `游戏/LICENSE.md`。本适配不恢复上游背景音乐。播放器新增代码继续使用MPL-2.0。
