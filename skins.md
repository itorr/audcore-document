# 皮肤列表

每个皮肤以自己的独立仓库为唯一维护来源。通过 PR 追加一行登记，初次收录人工审核；元数据与构建规则维护在仓库根目录 manifest.json，介绍和截图维护在 README.md。

本表登记源码项目，不代表最新提交或 tag 已获准发布；可安装版本以官方签名在线列表为准。

| ID | 名称 | 类型 | 仓库 |
| --- | --- | --- | --- |
| cn.audcore.routing-matrix | 表格 | web | https://github.com/audcore/audcore-skin-sheet |
| cn.audcore.example.web-desktop | 网页桌面皮肤 | web | https://github.com/audcore/audcore-skin-desktop |
| cn.audcore.rack-mixer | 机架调音台 | web | https://github.com/audcore/audcore-skin-rack |
| cn.audcore.node | 节点 | web | https://github.com/audcore/audcore-skin-node |
| cn.audcore.studio-mixer | Studio | web | https://github.com/audcore/audcore-skin-studio |
| cn.audcore.studio-mixer-v2 | Studio V2 | web | https://github.com/audcore/audcore-skin-studio-v2 |
| cn.audcore.xair-mixer | AIRCORE | web | https://github.com/audcore/audcore-skin-aircore |
| cn.audcore.signal-hud | Signal HUD | web | https://github.com/audcore/audcore-skin-signal-hud |
| cn.audcore.live-console | 直播操作台 | web | https://github.com/audcore/audcore-skin-live |
| cn.audcore.terminal | 命令终端 | web | https://github.com/audcore/audcore-skin-terminal |
| cn.audcore.skin.win98 | Audcore 98 | native | https://github.com/audcore/audcore-skin-win98 |
| cn.audcore.ttplayer | 声声静听 | native | https://github.com/audcore/audcore-skin-ttplayer |
| cn.audcore.floating-menu | 声核悬浮菜单 | native | https://github.com/audcore/audcore-skin-floating |

类型使用 web（网页）或 native（原生）。ID 与产物一致且保持稳定，名称的国际化翻译以作者 manifest 为准。版本、简介、语言、图片和审核状态不在此表重复维护。

[开始开发](docs/皮肤开发指引.md) · [统一开发与发布规范](docs/皮肤发布规范.md) · [skin-dev](https://audcore.utae.cn/skin-dev/)

官方更新只从各项目固定的源码提交构建，构建输入无变化时跳过；未参与打包的 README 等文档变化也跳过编译。构建成功且产物校验通过后才更新成功记录，失败不推进记录。
