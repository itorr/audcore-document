# 原生进程内皮肤开发说明

原生皮肤是与声核同架构的可信进程内 Windows DLL，统一使用 `.skin.audcore` 扩展名，由宿主按文件头识别。接口仍在实验阶段，使用前检查版本和结构大小。

## 原生 C ABI

准确结构、调用约定及版本检查以 `audcore_skin.h` 为准；生命周期见本节，头文件可从上方链接下载。这是可信进程内接口，皮肤崩溃或恶意代码可影响整个程序。

| 方向 | 接口 | 作用 |
| --- | --- | --- |
| 宿主 → 皮肤 | `audcore_skin_get_descriptor(requested_major)` | 获取描述符，协商主版本 |
| 宿主 → 皮肤 | `create(host)`、`show(instance)`、`hide(instance)`、`destroy(instance)` | 管理实例及显示生命周期 |
| 皮肤 → 宿主 | `register_window(ctx, hwnd, spec)` / `unregister_window(ctx, hwnd)` | 登记 / 注销窗口与尺寸规则 |
| 皮肤 → 宿主 | `command(ctx, request_id, request)` | 发送 UTF-8 JSON 命令；返回成功仅表示接收，最终结果通过响应事件返回 |
| 皮肤 → 宿主 | `subscribe(ctx, callback, user, subscription)` / `unsubscribe(ctx, subscription)` | 接收或停止事件；成功订阅先收到快照 |
| 皮肤 → 宿主 | `request_snapshot(ctx, subscription)` | 修订缺口后请求快照 |

事件类型为 `SNAPSHOT`、`DELTA`、`TRANSIENT`、`RESPONSE`、`ERROR`；事件含 `revision`、`request_id`、`status` 和 UTF-8 负载。字节与回调事件只在调用期间有效，需保留时复制。描述符还声明亮暗主题和缩放范围，窗口规则声明默认、最小、最大客户区尺寸与是否允许调整大小 / 最大化。桌面坐标为物理像素，客户区尺寸为逻辑像素。

原生命令使用与适配器一致的命令名及 JSON 参数；例如 `menu.openChannel`、`effect.openBrowser`、`window.close`，不将网页 JavaScript 调用签名当成 C ABI。原生菜单锚点为 `anchor: {x, y, space: "screen-physical"}`，可以为负坐标。原生皮肤自行接收 OLE 拖放时，可通过 `host.openDroppedFile` 交给宿主处理受支持的单个皮肤包或工程文件；此路径接口不开放给网页。网页示例传入客户区 CSS 像素 `anchor: {x, y}`（例如 `event.clientX`、`event.clientY`）。

所有界面调用与回调在非音频线程执行；窗口操作遵守宿主 UI 线程要求。关闭时先停止操作、取消订阅并清理窗口，再销毁实例和卸载模块。宿主统一处理隐藏、休眠、订阅释放和恢复。


## 标准命令与状态

原生命令通过 `command` 发送，命令名称及参数语义可参考 [网页皮肤接口清单](https://audcore.utae.cn/skin-dev/web.md)，但 JSON 参数与网页函数签名并非 C ABI，需按宿主协议构造；原生菜单锚点使用屏幕物理坐标。不要假定所有网页便利方法均可直接用于原生。

## 头文件

下载 [audcore_skin.h](https://audcore.utae.cn/skin-dev/audcore_skin.h)，或 [在线查看接口声明](https://audcore.utae.cn/skin-dev/native-abi.md)。
