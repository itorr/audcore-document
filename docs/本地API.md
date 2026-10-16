# 声核本地 API

公开本地接口使用 JSON WebSocket，采用 REST 资源风格的请求方法与路径。完整接口说明、可操作演示及固定版本 SDK 位于 [官网 API 页面](https://audcore.utae.cn/api/)。

## 连接与授权

在声核「设置 → API 连接管理」开启本地 API，复制连接地址。主实例默认 `ws://127.0.0.1:38533/api/v1`，多开实例使用独立端口。

连接首条消息：

```json
{"id":"1","method":"POST","path":"/connections","body":{"app_name":"我的控制面板"}}
```

首次申请返回 202，用户在声核客户端允许后，收到 `authorized` 事件与应用凭证。以后在 `body.token` 中提交该凭证，验证成功返回 200。等待允许期间不能读取或控制。网页凭证绑定实际 Origin；应用名称只用于展示。拒绝、撤销或关闭 API 后停止访问。

## 固定版本 SDK

SDK 独立版本为 **1.0.0**，API 协议版本为 **v1**。版本文件发布后保持不变；使用时固定完整版本号，不使用 latest。

```js
import { AudcoreClient } from
  'https://audcore.utae.cn/sdk/1.0.0/audcore.mjs';

const client = new AudcoreClient({ appName: '我的控制面板' });
client.on('authorization-pending', () => {
  console.log('请在声核中允许连接');
});
await client.connect();
const channels = await client.getChannels();
console.table(channels);
await client.updateChannel(channels[0].id, { mute: false });
const effects = await client.getEffects(channels[0].id);
if (effects.length) {
  const parameters = await client.getParameters(effects[0].id);
  const parameter = parameters.find(p => p.writable);
  if (parameter) await client.setParameter(effects[0].id, parameter.id, 0.5);
}
```

SDK 默认在网页来源的 IndexedDB 保存凭证，支持传入自己的异步 `storage`（`get`、`set`、`delete`）。非浏览器环境还可传入 WebSocket 实现。凭证不得写入公开源码或 URL。

## 请求与资源

请求包含 `id`、`method`、`path`、可选 `body`。响应包含同一 `id`、`status` 和 `data`。失败时 `data.error` 包含 `code` 与 `message`。支持的业务接口均要求授权。

| 方法 | 路径 | 功能 |
| --- | --- | --- |
| GET | `/info` | 运行版本、协议版本、实例标识 |
| GET | `/devices` | 设备列表、已知声道能力与当前选择 |
| GET | `/status` | 音频运行状态、采样率、缓冲、延迟 |
| GET | `/channels` | 用户通道列表，含视觉位置、对齐分组、输入及发送 |
| GET / PATCH | `/graph` | 完整音频图及带版本检查的批量结构编辑 |
| GET | `/plugins` | 可添加的已安装效果器目录 |
| GET / PATCH | `/channels/{id}` | 读取通道；调整 `gain_db`、`mute` |
| GET | `/channels/{id}/effects` | 效果器列表 |
| GET / PATCH | `/effects/{id}` | 读取效果器；调整 `bypass` |
| GET | `/effects/{id}/parameters` | 参数列表、元数据与当前值 |
| GET / PATCH | `/effects/{id}/parameters/{parameterId}` | 读取参数；写入 `normalized` |
| GET | `/meters` | 当前通道电平 |
| POST | `/subscriptions` | 创建资源订阅 |
| DELETE | `/subscriptions/{id}` | 取消订阅 |
| DELETE | `/connections/current` | 断开并清理当前连接 |

所有资源 ID 为字符串。音量范围为 -90 至 12 dB；参数归一化值范围为 0–1。离散参数按步数取整；参数响应包含是否可写、默认值、名称、单位、当前值以及可用的实际值和显示文本。离线或未加载效果器不能读取参数。新增图编辑接口支持通道增删、效果器装卸排序及当前端点间的路由编辑；仍不开放全局设备切换、音频启停或文件操作。新增接口需本次更新后的主程序，旧版返回 404。

状态码：200 成功，201 创建订阅，202 等待授权，400 无效请求或值，401 凭证失效，403 未授权，404 不存在，409 暂不可用，429 超过限制。

## 实时订阅与退出

```js
const subscription = await client.subscribe(
  '/channels', { frequencyHz: 10 },
  (data, event) => console.log(event.event, event.resource, data)
);
await subscription.unsubscribe();
await client.disconnect();
```

订阅先发送 `snapshot`，之后发送子资源的 `update`、`removed`；消息包含 `subscription_id`、`resource`、`sequence`、`data`。快照序号为 0，增量递增。创建订阅响应与初始快照可能交错，SDK 已处理这一顺序。

频率默认 10 Hz，允许 1–30 Hz，是连续变化的最大发送频率；同一资源期间合并为最新值。资源删除立即通知。列表订阅的增量是单个资源，不是每次重发整份列表。插件内部未主动报告给宿主的变化无法保证推送。

正常断开立即清理全部订阅，网络失联通过心跳最长约 45 秒清理。SDK 默认自动重连并重建订阅、重新接收快照；主动断开、拒绝或撤销后不重连。每连接最多 32 个订阅，每秒最多 120 个请求；输入消息上限 64 KiB。等待授权最多 120 秒。

## 浏览器使用

官网提供跨来源加载固定版本 SDK 的响应头。SDK 使用本机 WS 地址，浏览器若询问本地网络权限，需要用户允许。第三方网页的 CSP 也须允许连接 `ws://127.0.0.1:对应端口`。此接口面向本机工具，手机和其他电脑的远程控制另用局域网控制入口。

## 节点图、视觉顺序与输入输出（本次更新新增）

`GET /graph` 返回 `revision`、图状态单调递增的 `sequence`、`visual_order`、`inputs`、`outputs` 和 `graph`。`revision` 是并发编辑凭据，必须原样用于下一次结构编辑，不能自行生成。图内通道、效果器和发送使用宿主原生标识；通道资源的 `id` 对应 `chain_uuid`（缺失时为内部 ID 字符串），不能与原生 `chain.id` 混用。

- `/channels` 中的 `index` 是稳定的内部 ID，不代表显示位置。`visual_index` 才是从 0 开始的视觉位置；`align_right` 表示右侧常驻区域。`visual_order` 按普通通道在前、常驻通道在后的原生显示规则列出可见通道的资源 ID。
- `inputs` / `outputs` 列出当前逻辑端点：`id`（如 `input:0`）、`pair_index`、从 0 开始的 `channel_offset`、独立 `device` 和当前全局 `primary_device`。独立设备存在时优先使用它；未选择的设备保持空值，不自动猜测第一张声卡。虚拟输入和录音端点由 `virtual_input` / `virtual_recording` 单独表示。
- `graph.input_pairs` / `output_pairs` 的数组下标是逻辑端点 ID，数组值是声道偏移。`input_devices` / `output_devices` 是独立设备绑定，不能把两个不同设备的相同声道偏移当作同一端点。
- `graph.chains[].inputs` 引用输入端点，`rack` 数组是实际效果顺序。`sends` 给出输出、目标通道或侧链实例，保留启用状态、增益和取样点。隐藏辅助通道仍在完整图中，编辑器应保留它们。
- 新效果器从 `/plugins` 目录选择，提交准确的 `path`、`cid`、`fuid` 及新的安全整数 `instance`。不接受任意文件路径；虚拟跳线组件不在普通添加目录中。

结构编辑使用固定 SDK 的通用请求方法，不更改已发布的 SDK 1.0.0 文件：

```js
const current = await client.request('GET', '/graph');
await client.request('PATCH', '/graph', {
  revision: current.revision,
  edits: [{
    op: 'set', target: { kind: 'chain', chain: 0 },
    fields: { inputs: [0] }
  }]
});
```

支持操作：`add_chain`（先新增空通道）、`remove_chain`、`order_chains`（全部原生通道 ID 各出现一次）、`set_rack`、`set_sends`，以及通道的 `name` / `inputs` 字段。一个批次可先新增空通道，再配置效果链和路由。最多 512 项操作，仍受输入消息 64 KiB 限制。隐藏通道不可修改，重复实例、无效端点及反馈回路拒绝；删除节点须在同一批次清理引用。音量、静音、旁通和参数继续使用原有专用接口。

结构操作在音频运行时执行并进入原生撤销历史；验证失败不会应用，加载失败会尝试恢复原图与已保存参数。恢复失败会明确返回 `recovery_failed`，不得将其显示为编辑成功。版本冲突返回 409 / `graph_conflict`，客户端以推送后的最新图为准重新操作，不自动覆盖其他窗口的修改。

订阅 `/graph` 后先收到完整快照；之后的增量含 `base_revision`、`revision`、图状态 `sequence`、`visual_order` 和 `edits`。节流周期内的多个增量以 `changes` 数组按顺序聚合，必须逐项应用，不得只保留最后一个。结构积压达 128 项时提前发送以限制队列体积。已由请求响应确认的旧增量按图状态 `sequence` 跳过；该值与外层订阅消息的 `sequence` 不同。重连后重新接收快照。可订阅 `/plugins` 接收目录变更。


## 独立调音台的临时独奏

新增本地资源 `/solo`（需配套更新版主程序），支持 GET、PATCH 与订阅。状态为 `selected`、`safe`、`excluded` 三组原生通道编号；使用 `/channels` 的 `index` 对应，不能用视觉位置代替。订阅先发送完整快照，之后原生控制台或 API 修改独奏时主动推送新状态。

`PATCH /solo` 接受 `{"channel":"通道资源ID","on":true}` 加入独奏、`on:false` 取消该通道，或 `{"clear":true}` 清除全部独奏。`channel` 使用 `/channels` 的字符串 `id`；请求不能混合其他字段，隐藏通道或无效 ID 被拒绝。`safe` 只读并保留主控制台已有设置。

独奏属于临时监听状态，不改变保存的静音、音量、路由与撤销历史。断开控制器不擅自清除其他控制台的独奏；可用“取消独奏”明确清除。该资源不开放给受限局域网控制接口。旧版返回资源不存在，客户端应禁用独奏，不能通过批量写静音模拟。
