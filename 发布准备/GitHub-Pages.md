# GitHub Pages 中英文版

地址：https://jiushiaaa.github.io/suiren/

源码在main，发布产物在gh-pages。两个分支用途不同：不要把gh-pages合并回main。上游与本作提交历史都保留在main。当前GitHub OAuth无workflow写权限，因此使用原生分支发布，不增大凭据权限。

## 后续更新

1. 在main完成相关检查和 `npm --prefix 游戏 run build`。
2. 在仓库外临时目录正常克隆 `git clone --single-branch --branch gh-pages https://github.com/jiushiaaa/suiren.git <临时目录>`。
3. 仅更新这个独立临时克隆的构建产物为 `游戏/dist/` 内容，保留`.git`与`.nojekyll`。不复制仓库根、验证存档、文案包或凭据。确认许可与来源说明仍在。
4. 在临时克隆审查diff，正常commit/push，无需强推；Pages自动构建。
5. 用 `gh api repos/jiushiaaa/suiren/pages/builds/latest` 确认built，并在公开地址检查页面与静态资源。源码提交不等于Pages自动更新，产物必须另行部署。

## 保存边界

Pages无幻光SDK，使用现有本机IndexedDB自动保存。此网址与幻光的存档隔离，不会自动同步账号云档。换浏览器、清除网站数据或换域名都不能当作跨设备存档。旧导出、中文Gemini基线未修改。

## 首次部署

源码基础9e81ca1／游戏1.0.2；构建310文件，发布加入`.nojekyll`共311文件，约35MB。完整回归1187/1187通过（509.06秒）。英文候选仅保存在本地化目录，未进入中文版构建。线上验证结果见HANDOFF顶部。
