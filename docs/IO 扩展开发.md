# 声核 IO 扩展开发

声核 IO 让 Windows x64 原生扩展为调音台提供音频输入、输出或配对端点。宿主通过 C ABI 调用扩展，可使用能生成 Windows x64 DLL 并导出 C 函数的语言。本文对应暂定 ABI **1.5**，需要带 IO 扩展支持的声核。

## 跑通最小输入

1. 下载并解压 [最小样例 ZIP](https://audcore.utae.cn/io-dev/audcore-io-example.zip)。
2. 在 Visual Studio 的 x64 Native Tools Command Prompt 中进入样例目录，运行 `cl /nologo /O2 /LD tone.c /link /OUT:tone.in.audcore /EXPORT:audcore_io_entry`。
3. 在声核托盘菜单中选择 **打开配置目录**。把 `tone.io.json` 和 `tone.in.audcore` 并排放到其中的 `extensions/io`，必要时创建目录。便携版为程序旁的 `Audcore-data`，安装版默认为 `%LOCALAPPDATA%\AudCore`。
4. 重新启动声核，在通道输入菜单选择 **Test Tone**，开启音频并观察通道电平。样例输出 440 Hz 低电平单声道信号，可从 **设置 → 输入输出 → 扩展输入输出** 卸载。

## 二进制与清单

| 二进制后缀 | `directions` | 用途 |
| --- | ---: | --- |
| `.in.audcore` | 1 | 输入 |
| `.out.audcore` | 2 | 输出 |
| `.io.audcore` | 3 | 共用一个实例的配对输入输出 |

每个扩展带一个 UTF-8 的 `*.io.json`。文件须直接放在同一个 `extensions/io` 目录下。

```json
{
  "id": "example.audcore.tone",
  "name": "Test Tone",
  "version": "1.0.0",
  "directions": 1,
  "abi_major": 1,
  "min_host_minor": 5,
  "menu": true,
  "direct": true,
  "input_channel_mode": 1,
  "binary": "tone.in.audcore"
}
```

- `binary` 是同目录文件名。后缀、清单和二进制声明的方向必须一致。描述符的 `id`、`version` 也必须与清单一致。
- `id` 是扩展的长期标识。使用自己控制的命名空间，不随版本或显示名变化。需要区分方向时，可填 `input_name`、`output_name`。
- 通过通道菜单接入时设 `menu: true`。只有一个可直接选择的项目时可设 `direct: true`，由宿主直接进入该项目或其选项窗口。
- `input_channel_mode` 可省略，让用户在通道设置中选择。固定双声道填 `0`，固定左侧单声道填 `1`。每个端点实际供给的声道数由其绑定声明，启动时读取 `config.channels`。
- 对随播放暂停、回卷的宿主时钟输入，可在清单设 `follows_transport: true`，也可以通过绑定声明。

## 入口与音频流

ZIP 内的 `audcore_io.h` 定义结构布局和函数签名。导出 `audcore_io_entry(host_major, host_minor)`，在版本兼容时返回静态描述符。填写各结构的 `size`、`major` 和 `minor`。宿主版本不兼容时返回空指针。访问传入结构之前检查尺寸，调用可选函数之前确认指针非空。

`create` 创建实例，`start` 接收方向、时钟、采样率、声道数、端点和配置，`running` 报告流状态。生命周期调用在非音频线程串行执行，调用线程可以变化。若窗口或设备有线程亲和性，由扩展在自己的线程处理。

- PCM 为交错的 `float32`，长度参数按帧计。输入使用 `write`，输出使用 `read` 或宿主提供的可选读取函数。根据实际返回帧数处理短写和短读。
- **宿主时钟输入**按 `config.sample_rate` 供帧，使用 `buffered_frames` 控制提前量。检测到 `requested_epoch` 改变后，在写入新一轮数据前调用 `begin_epoch`。本样例走这条路径。
- **独立时钟输入**按设备实际节奏供帧，先用 `input_format` 报告实际采样率和周期，再写入 PCM。同一输入的格式变更、重置和写入由一个生产者串行执行。
- **输出**在工作线程读取发送到该端点的 PCM。设备有独立时钟且宿主提供 `read_at_rate` 时，可请求目标设备采样率，由宿主处理转换与漂移。仅在宿主提供 `set_demand` 时，用它声明消费者是否活跃。
- 配对端点按方向 `3` 启动一个流，可从 `output_endpoint` 和 `output_channels` 读取输出侧配置。需要配对的两个菜单绑定使用同一个稳定的 `instance_key`。
- `start` 返回后，不能继续引用借来的端点或配置切片。要跨调用使用就复制所需内容。宿主回调的上下文在流停止前有效。
- `stop` 发出停止信号，等待线程和回调退出，关闭设备或句柄。返回后不再调用宿主。取消订阅也要等回调退出。最后由 `destroy` 释放实例。文件、网络、窗口、解码和等待操作都放在音频线程之外。

## 菜单、设置与预设

`control.invoke` 在非音频线程接收 UTF-8 JSON。每次调用返回前用 `respond` 回应一次。回应成功时传 JSON，失败时传简短错误。字节切片带长度，可以没有结尾空字符。

- `menu` 读取 `direction` 和 `context`，返回 `revision`、根组 `root` 和项目。组可嵌套，每组用 `single` 或 `multiple` 控制单选或多选。
- `select` 接收菜单版本、`group_path`、`item_id`、目标 `selected` 和可选的 `options`。返回更高的 `revision`、目标选中状态和候选 `binding`。候选可能被宿主拒绝，收到选择请求时不要直接写入持久状态。
- 每个 `binding` 返回 `endpoint_id`、`display_name`、`direction`、`channels`、`clock`、`state_version`、`state`。其中 `clock` 为 `host` 或 `independent`，`state` 为字节数组。宿主保存绑定和状态，菜单按宿主提供的 `context.selected` 反映已提交选择。预设不携带扩展二进制。
- 需要额外选项时为菜单项目设 `needs_options`，通过 `dialog.kind` 请求宿主文件选择器 `file`，或让扩展提供原生设置窗 `plugin`。扩展有全局设置或已选端点的右键菜单时，分别在清单声明 `global_settings` 或 `context_menu`。

一个菜单的返回值可以写成下面这样。子菜单项使用 `{"kind":"group","group":{...}}`，`group` 与根组使用相同结构。

```json
{
  "revision": 1,
  "root": {
    "id": "root",
    "label": "",
    "mode": "single",
    "children": [
      {"kind":"choice","id":"tone","label":"Test Tone","selected":false,"enabled":true,"needs_options":false}
    ]
  }
}
```


本地开发可直接放置清单和 DLL。应用内的官方安装列表来自独立发布的签名目录。
