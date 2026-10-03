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
| GET | `/channels` | 用户通道列表 |
| GET / PATCH | `/channels/{id}` | 读取通道；调整 `gain_db`、`mute` |
| GET | `/channels/{id}/effects` | 效果器列表 |
| GET / PATCH | `/effects/{id}` | 读取效果器；调整 `bypass` |
| GET | `/effects/{id}/parameters` | 参数列表、元数据与当前值 |
| GET / PATCH | `/effects/{id}/parameters/{parameterId}` | 读取参数；写入 `normalized` |
| GET | `/meters` | 当前通道电平 |
| POST | `/subscriptions` | 创建资源订阅 |
| DELETE | `/subscriptions/{id}` | 取消订阅 |
| DELETE | `/connections/current` | 断开并清理当前连接 |

所有资源 ID 为字符串。音量范围为 -90 至 12 dB；参数归一化值范围为 0–1。离散参数按步数取整；参数响应包含是否可写、默认值、名称、单位、当前值以及可用的实际值和显示文本。离线或未加载效果器不能读取参数。不开放设备切换、音频启停、结构编辑或文件操作。

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
