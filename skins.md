# 皮肤源码列表

按界面形式选择皮肤。每款只在对应独立仓库维护，介绍、操作和构建方法见仓库首页。

源码登记不代表已更新在线安装包，可安装版本以官方签名列表为准。

| ID | 名称 | 类型 | 仓库 |
| --- | --- | --- | --- |
| cn.audcore.routing-matrix | 表格调音台 | web | https://github.com/audcore/audcore-skin-spreadsheet-mixer |
| cn.audcore.example.web-desktop | 通道条调音台 | web | https://github.com/audcore/audcore-skin-channel-strip-mixer |
| cn.audcore.rack-mixer | 横向机架调音台 | web | https://github.com/audcore/audcore-skin-rack-mixer |
| cn.audcore.node | 节点连线调音台 | web | https://github.com/audcore/audcore-skin-node-routing |
| cn.audcore.studio-mixer-v2 | 录音棚调音台 | web | https://github.com/audcore/audcore-skin-recording-console |
| cn.audcore.xair-mixer | X AIR 数字调音台 | web | https://github.com/audcore/audcore-skin-xair-mixer |
| cn.audcore.signal-hud | 电平仪表盘 | web | https://github.com/audcore/audcore-skin-meter-dashboard |
| cn.audcore.live-console | 直播操作台 | web | https://github.com/audcore/audcore-skin-live-control |
| cn.audcore.terminal | 命令终端调音台 | web | https://github.com/audcore/audcore-skin-command-terminal |
| cn.audcore.skin.win98 | Windows 98 桌面调音台 | native | https://github.com/audcore/audcore-skin-windows98-desktop |
| cn.audcore.ttplayer | TTPlayer 三窗口调音台 | native | https://github.com/audcore/audcore-skin-ttplayer-mixer |
| cn.audcore.floating-menu | 悬浮菜单调音台 | native | https://github.com/audcore/audcore-skin-floating-menu |

## 新增或更新皮肤

- 在本表追加一行，通过 PR 完成人工准入；不要把其他皮肤的新版本另建为重复项目。
- 仓库名写明界面形式或用途，README 开头直接介绍能做什么，避免只写原型代号或“独立皮肤与开发参考”。
- manifest.json 统一维护元数据与构建规则，README 写清安装、操作、开发和反馈入口。
- 更新从对应仓库的固定提交构建；真实构建输入无变化时跳过，未打包文档的变化不触发编译。
- 只有成功构建并通过产物校验后才更新成功记录，失败不推进记录。

[开始开发](docs/皮肤开发指引.md) · [构建与发布规范](docs/皮肤发布规范.md) · [skin-dev](https://audcore.utae.cn/skin-dev/)
