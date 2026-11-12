# 网页皮肤开发说明

网页皮肤运行在声核的 WebView2，接口仍在开发中。无需开启本地 WebSocket API。

## 快速开始

网页皮肤是 ZIP 文件，包根目录放 `manifest.json`，扩展名使用 `.skin.audcore`。通过声核的打开文件入口安装并在设置中应用。

```json
{
  "id": "example.my-skin",
  "name": "我的皮肤",
  "author": "作者",
  "version": "1.0.0",
  "api": { "major": 1, "minor": 0 },
  "entry": "index.html",
  "window": { "default": [720, 480], "min": [320, 240], "max": null, "resizable": true, "maximizable": true },
  "themes": ["dark", "light"],
  "scale": { "min": 0.75, "max": 2, "default": 1 },
  "languages": ["zh", "en", "ja"]
}
```

入口路径相对于包根目录；将 HTML、CSS、`.mjs` 和其他资源一同打包。Windows PowerShell 可在包目录执行 `Compress-Archive -Path * -DestinationPath ../skin.zip`，再将文件重命名为 `.skin.audcore`。请使用唯一稳定的 ID，更新时沿用 ID 并提高版本号。

```js
const stop = await window.audcore.state.subscribe(event => {
  // 先接收快照，再按顺序处理增量；界面读取宿主真实状态。
  console.log(event);
});
// 页面清理时调用 stop()；电平只在需要时单独订阅。
```

宿主注入 `window.audcore`；不要自行通过 WebSocket 模拟真实宿主。菜单和标准浮层调用宿主接口，页面负责入口和界面。显示颜色使用 `channels[].displayColor`；设备名称使用宿主提供的标签。缩放与系统 DPI 分开；亮暗采用全局设置，支持单一主题的皮肤使用自己声明的主题；声核本体仍可自由切换亮色或暗色，不受皮肤支持范围限制。不为每个皮肤单独保存亮暗选择。休眠、恢复和订阅生产由宿主管理。

启动时若 `window.audcore.window.requiresStartup()` 为真，调用 `showUnderCover()`，在实际界面完成首帧绘制后调用 `presentFrame()`；失败调用 `startupFailed()`。不要用资源加载完成代替界面首帧。官网模拟只使用模拟状态和操作，不代表已连接本机声核。

## 网页接口使用规则

以下方法均以 `window.audcore.` 开头。除同步读取和启动交接外，跨桥方法返回 Promise；失败会 reject。状态以宿主推送为准，命令成功不代表可以跳过后续状态更新。接口行为以当前宿主版本为准。

通用参数：`id` 为通道 ID，`instance` 为效果器实例 ID，`index` 为对应列表位置，`db` 为分贝，布尔参数表示目标状态。`expectedChannel`、`expectedEffect`、`expected`、`expectedTarget`、`expectedRack` 是操作时的身份或列表快照，用于拒绝过期操作；应从当前状态保存，涉及复制和文件拖入的接口尤其需要完整快照。发送列表以当前状态中的 `sends` 为准。接口签名展示了 JavaScript 参数，不代表可随意省略身份校验。

### 状态、通知和电平

| 方法 | 用途 / 返回 |
| --- | --- |
| `state.subscribe(listener)` | 订阅权威状态，返回 Promise，兑现为取消订阅函数；当前仅允许一个状态订阅 |
| `state.resync()` | 发现修订缺口时请求当前快照 |
| `notifications.subscribe(listener)` | 监听提示，同步返回取消订阅函数；包括 `error`、`info`、`recording_saved`、`recording_expired` |
| `meters.subscribe(listener, options = {})` | 订阅可丢弃的电平帧；`options.loudness` 可请求响度，仅允许一个电平订阅；返回取消订阅函数 |
| `meters.setLoudness(enabled)` | 改变响度订阅需求 |
| `i18n.getLanguage()` | 同步读取缓存语言 |
| `i18n.t(key)` | 同步读取公共翻译；具体格式见 `i18n-cache.mjs` |
| `i18n.setLanguage(language)` | 请求切换语言 |
| `close({ releaseHost = true } = {})` | 关闭桥并释放监听；正常页面代码应在卸载时清理订阅 |

状态订阅先收到 `snapshot`，之后收到连续修订号的 `change`、`patch`、`graph_patch`、`channel`、`channel_batch`、`effect_batch`、`order`、`structure`、`primary`；发现缺口应停止应用增量并重同步。电平属于瞬时数据，可以合并或丢弃，不占权威修订号。休眠和恢复由宿主管理，不用网页定时轮询状态。`recording_saved` 提供 `name` 和 `token`，可调用 `recording.revealSaved(token)` 定位保存结果。

### 播放、工程和历史

| 方法 | 用途 |
| --- | --- |
| `transport.setPlaying(playing)` | 请求播放或暂停 |
| `recording.revealSaved(token)` | 显示刚保存的录音 |
| `document.new()` / `document.open()` / `document.save()` | 新建、打开或保存工程 |
| `history.beginEdit()` / `history.endEdit()` | 将连续拖动等操作组织为一次编辑；结束或页面隐藏时关闭编辑 |
| `history.undo()` / `history.redo()` | 撤销 / 重做 |
| `settings.open()` / `performance.open()` | 打开宿主设置 / 性能面板 |

### 通道与发送

| 方法 | 用途 |
| --- | --- |
| `channel.add(mode)` | 按模式新建通道 |
| `channel.remove(id, expectedChannel)` | 删除通道 |
| `channel.setName(id, name, expectedChannel)` | 修改名称 |
| `channel.setMute(id, muted, expectedChannel)` | 静音 |
| `channel.setSolo(id, solo, expectedChannel)` | 独奏 |
| `channel.setSoloSafe(id, safe, expectedChannel)` | 独奏保护 |
| `channel.setGain(id, db, expectedChannel)` | 设置音量 |
| `channel.setRecording(id, recording, expectedChannel)` | 设置录音 |
| `channel.setPhase(id, degrees, expectedChannel)` | 设置相位 |
| `channel.setFxBypass(id, bypass, expectedChannel)` | 旁通通道效果链 |
| `channel.setInput(id, index, expectedChannel)` | 设置输入 |
| `channel.setHidden(id, hidden, expectedChannel)` / `channel.showHidden()` | 隐藏通道 / 显示隐藏通道 |
| `channel.setAlignRight(id, right, expectedChannel)` | 设置通道靠右 |
| `channel.setOrder(ids, expected)` | 按完整 ID 列表排序 |
| `channel.addSend(id, targetId, expectedChannel)` | 添加发送 |
| `channel.removeSend(id, index, expected)` | 删除发送 |
| `channel.moveSend(id, from, to, expected, expectedChannel)` | 调整发送顺序 |
| `channel.setSendLevel(id, index, db, expected)` | 设置发送电平 |
| `channel.setSendEnabled(id, index, enabled, expected)` | 启用或停用发送 |
| `channel.setSendTap(id, index, tap, expected)` | 设置发送取点 |

### 效果器和文件拖放

| 方法 | 用途 |
| --- | --- |
| `effect.openBrowser(id, expectedChannel)` | 打开宿主效果器选择界面 |
| `effect.openEditor(id, instance, expectedEffect)` | 打开效果器界面 |
| `effect.move(id, instance, index, expectedEffect, expectedTarget)` | 移动效果器 |
| `effect.moveSlot(id, instance, index, expectedEffect, expectedTarget)` | 按链接插槽移动效果器 |
| `effect.copyTo(id, instance, target, index, expectedEffect, expectedChannel, expectedRack)` | 复制效果器到目标通道 |
| `effect.setBypass(id, instance, bypass, expectedEffect)` | 设置效果器旁通 |
| `effect.setWet(id, instance, wet, expectedEffect)` | 设置干湿比例 |
| `effect.setPrimary(id, instance, parameter, normalized, expectedEffect)` | 设置主要参数的归一化值 |
| `effect.resetPrimary(id, instance, parameter, expectedEffect)` | 重置主要参数 |
| `effect.remove(id, instance, expectedEffect)` | 移除效果器 |
| `effect.insertDroppedFile(file, channel, index, expectedChannel, expectedRack)` | 将真实拖入的文件交宿主处理并插入效果链 |
| `audio.dropFile(file, channel, expectedChannel)` | 将真实拖入的音频文件交宿主处理 |

网页拖放使用宿主提供的真实文件对象，不接受网页伪造的本机路径。文件类型、目标和身份由宿主校验。

### 宿主菜单

菜单内容和操作由宿主处理；皮肤负责入口及锚点。锚点和身份应从当前交互与状态生成，坐标约定见下面原生与网页坐标说明。菜单类请求可能等待用户关闭界面，不套用普通请求超时。

| 方法 | 打开的菜单 |
| --- | --- |
| `menu.openSystem(anchor)` | 主菜单 |
| `menu.openTransport(anchor)` | 播放控制 |
| `menu.openAddChannel(anchor)` | 新增通道 |
| `menu.openChannelList(anchor)` | 通道列表 |
| `menu.openChannelSettings(id, expectedChannel)` | 直接打开通道设置，校验当前通道身份 |
| `menu.openChannel(id, anchor, expectedChannel, inputContext = false)` | 通道菜单，可指定输入上下文 |
| `menu.openInput(id, anchor, expectedChannel)` | 输入选择 |
| `menu.openInputContext(id, anchor, expectedChannel)` | 输入右键菜单 |
| `menu.openShortcut(id, anchor, expectedChannel)` | 通道快捷键 |
| `menu.openRecording(id, anchor, expectedChannel)` | 录音 |
| `menu.openLink(id, anchor, expectedChannel)` | 通道链接 |
| `menu.openLinkSettings(id, anchor, expectedChannel)` | 链接设置 |
| `menu.openSolo(id, anchor, expectedChannel)` | 独奏 |
| `menu.openAddSend(id, anchor, expectedChannel)` | 新增发送 |
| `menu.openSend(id, index, anchor, expected)` | 发送菜单 |
| `menu.openSendPrimary(id, index, anchor, expected)` | 发送主要控制 |
| `menu.openEffect(id, instance, anchor, expectedEffect)` | 效果器菜单 |

### 外观和窗体

| 方法 | 用途 |
| --- | --- |
| `appearance.setTheme(theme)` | 请求 `dark` 或 `light`，由宿主按皮肤声明校验并推送确认 |
| `appearance.setScale(scale)` | 请求皮肤缩放；独立于系统 DPI |
| `window.getBounds()` | 读取物理位置、逻辑客户区尺寸、DPI 和置顶状态 |
| `window.setBounds({x, y, width, height})` | 请求调整窗口，字段可省略；成功表示宿主已接受 |
| `window.subscribeBounds(listener)` | 订阅窗口变化，返回取消订阅函数 |
| `window.getDisplays()` | 读取显示器、工作区物理坐标与 DPI |
| `window.setAlwaysOnTop(enabled)` | 修改声核共用的置顶设置 |
| `window.minimize()` / `window.toggleMaximize()` / `window.close()` | 最小化、切换最大化、关闭控制台 |
| `window.startDrag()` | 左键按下时委托宿主拖动窗体 |
| `window.startResize(direction)` | 委托调整窗体，方向为 `north`、`south`、`east`、`west`、`northEast`、`northWest`、`southEast`、`southWest` |
| `window.requiresStartup()` | 同步判断是否需要原生启动遮盖交接 |
| `window.showUnderCover()` | 请求在原生启动遮盖下显示网页 |
| `window.presentFrame()` | 最终界面绘制完成后通知宿主交接 |
| `window.startupFailed()` | 通知启动失败 |

窗体的 `x`、`y` 是虚拟桌面物理像素（可能为负），`width`、`height` 为 96 DPI 逻辑客户区尺寸；显示器 `bounds` 和 `workArea` 均使用物理像素。宿主按皮肤清单限制尺寸，拒绝无法在屏幕中看到的位置；异步移动的最终结果以订阅通知为准。浏览器预览使用模拟数据，不会改变真实浏览器窗体。

桌宠使用普通矩形窗口，整个客户区正常接收鼠标；无需透明背景或鼠标穿透。皮肤可以在同一窗体内切换小桌宠和展开面板。宿主菜单及浮层位于同一窗口内，打开前应先通过 `setBounds` 展开，并等待 `subscribeBounds` 推送实际尺寸，避免小窗口裁切内容；设置界面仍由宿主提供。

`state.display` 的 `dpi`、`clientWidth`、`clientHeight` 由宿主推送；客户区尺寸为 96 DPI 逻辑像素，皮肤缩放不重复乘入。网页模拟无法读取实际 DPI。声明默认、最小、最大尺寸及主题、缩放范围使用皮肤清单，参考本文的清单示例。

## 皮肤列表预览

网页皮肤的 `manifest.json` 可选声明 `"preview": "web/preview.png"`；路径必须指向包内已有 PNG，不允许越过包目录。设置页按 4:3 区域显示预览，未提供时显示“暂无预览”。官方目录将预览图片地址、大小和 SHA-256 写入签名清单；宿主校验后缓存，安装包和预览图均只从官网扩展目录获取。原生皮肤的官方预览也由目录提供。

官方目录与下载资源由声核维护；自行制作的皮肤可通过声核的打开文件入口安装。

正在使用的网页皮肤更新时，宿主保留主窗体，释放旧 WebView 和皮肤文件租约后安装，再在同一窗体恢复网页；失败时尝试恢复旧版本。原生 ABI 0.2 由皮肤创建并拥有 HWND，更新原生模块仍须销毁并重建该皮肤的窗体。

## 预览和已知边界

官网模拟由 `browser-preview.mjs` 和 `mock-audcore.mjs` 提供，使用固定数据及模拟菜单、设置、效果器选择等；部分操作只改变内存。它不安装皮肤、不操作真实音频或工程，也不连接本机程序。真实宿主的菜单与浮层定位、裁切、焦点及关闭行为仍需实际验证；本清单不将模拟通过等同于真实接入完成。

接口仍在持续完善；请根据当前声核版本验证实际行为，并处理不支持的接口和错误。
