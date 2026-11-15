import {requestService} from './config.mjs';

const api = new URL('/v1/store/aud-r', requestService.origin).href;
const checkout = document.querySelector('#checkout');
const check = document.querySelector('#check-order');
const copy = document.querySelector('#copy-order');
const feedback = document.querySelector('#order-status');
const key = 'audcore-aud-r-order';
const idPattern = /^AUD[0-9a-f]{32}$/;
const tokenPattern = /^[0-9a-f]{64}$/;
let order, current, stream, ready = false, busy = false, checking = false;

function restore(storageKey) {
  try { return JSON.parse(localStorage.getItem(storageKey)); } catch { return null; }
}

function save() {
  const value = JSON.stringify(order);
  localStorage.setItem(key, value);
  if (order.id) localStorage.setItem(`${key}-${order.id}`, value);
}

async function post(route, body = {}) {
  const response = await fetch(api + route, {
    method:'POST',
    headers:{'Content-Type':'application/json', Authorization:`Bearer ${order.token}`},
    body:JSON.stringify(body),
    signal:AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.error ?? '购买服务暂不可用，请稍后重试。');
  }
  return response;
}

function refreshButtons() {
  const paid = current?.status === 'paid';
  const pending = Boolean(order?.id && !paid && current?.status !== 'closed');
  checkout.textContent = paid ? '下载 VST3' : pending ? '继续支付宝付款' : '支付宝购买 · ¥9.90';
  checkout.disabled = busy || (!paid && !ready) || (pending && !order.request_id);
  check.hidden = !pending;
  copy.hidden = !pending && !paid;
  check.disabled = busy || checking;
}

function showOrder(result) {
  if (result?.id !== order?.id || !['pending','paid','closed'].includes(result?.status) ||
      !/^\d+\.\d+\.\d+$/.test(result.version) || current?.status === 'paid' && result.status !== 'paid') return;
  if (result.status !== 'pending') stream?.abort();
  if (current?.status === result.status) return;
  current = result;
  feedback.textContent = {
    pending:'等待付款确认。付款后可回到本页下载。',
    paid:`付款已确认，可下载 Aud-R v${result.version}。订单链接可用于再次下载，请妥善保存。`,
    closed:'这笔订单已关闭，可以重新购买。',
  }[result.status];
  refreshButtons();
}

async function subscribe() {
  stream?.abort();
  const controller = new AbortController();
  stream = controller;
  try {
    const response = await fetch(`${api}/events?order=${order.id}`, {
      headers:{Authorization:`Bearer ${order.token}`},
      signal:controller.signal,
    });
    if (!response.ok) throw new Error();
    let pending = '';
    for await (const chunk of response.body.pipeThrough(new TextDecoderStream())) {
      pending += chunk;
      let end;
      while ((end = pending.indexOf('\n\n')) !== -1) {
        const frame = pending.slice(0, end);
        pending = pending.slice(end + 2);
        const data = frame.split('\n').find(line => line.startsWith('data: '));
        if (data) showOrder(JSON.parse(data.slice(6)).order);
      }
    }
  } catch {
    if (!controller.signal.aborted && !current) feedback.textContent = '暂时无法读取订单，请点击「确认到账」重试。';
  }
}

async function checkOrder() {
  if (checking) return;
  checking = true;
  refreshButtons();
  try {
    const response = await post(`/orders/${order.id}/reconcile`);
    const result = await response.json();
    showOrder(result);
    if (current?.status === 'pending') feedback.textContent = '尚未确认到账。如果已付款，请稍后再确认。';
  } catch (error) {
    if (current?.status !== 'paid') feedback.textContent = error.message;
  } finally {
    checking = false;
    refreshButtons();
  }
}

function pay(payment) {
  if (payment?.gateway_url !== 'https://openapi.alipay.com/gateway.do') throw new Error('支付信息无效，请重试。');
  const gateway = new URL(payment.gateway_url);
  gateway.searchParams.set('charset', 'utf-8');
  const form = document.createElement('form');
  form.method = 'POST';
  form.acceptCharset = 'UTF-8';
  form.action = gateway.href;
  form.hidden = true;
  for (const [name, value] of Object.entries(payment.fields)) {
    if (name === 'charset') continue;
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.append(input);
  }
  document.body.append(form);
  form.submit();
  form.remove();
}

async function download() {
  const response = await post(`/orders/${order.id}/download`);
  if (response.headers.get('Content-Type') !== 'application/zip') throw new Error('下载暂不可用，请重试。');
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = `Aud-R-v${current.version}-vst3-win-x64.zip`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

checkout.addEventListener('click', async () => {
  if (busy) return;
  busy = true;
  refreshButtons();
  try {
    if (current?.status === 'paid') {
      await download();
      return;
    }
    if (!order || current?.status === 'closed') {
      order = {request_id:crypto.randomUUID(), token:[...crypto.getRandomValues(new Uint8Array(32))].map(byte => byte.toString(16).padStart(2,'0')).join('')};
      current = undefined;
    }
    try { save(); } catch { throw new Error('请允许本站保存订单，再发起付款。'); }
    feedback.textContent = '正在准备支付宝支付…';
    const response = await post('/orders', {request_id:order.request_id});
    const result = await response.json();
    if (!idPattern.test(result.id)) throw new Error('订单信息无效，请重试。');
    order.id = result.id;
    save();
    showOrder(result);
    if (result.payment) {
      subscribe();
      pay(result.payment);
    } else if (result.status === 'pending') feedback.textContent = '付款时限已到，正在核对订单。请稍后确认到账。';
  } catch (error) {
    feedback.textContent = error.message;
  } finally {
    busy = false;
    refreshButtons();
  }
});

check.addEventListener('click', checkOrder);
copy.addEventListener('click', async () => {
  const receipt = new URL('/aud-r/', location.origin);
  receipt.hash = new URLSearchParams({order:order.id, token:order.token}).toString();
  try {
    await navigator.clipboard.writeText(receipt.href);
    feedback.textContent = '订单链接已复制，请妥善保存。';
  } catch { feedback.textContent = '无法复制订单链接，请检查浏览器的剪贴板权限。'; }
});

window.addEventListener('pagehide', () => stream?.abort());
window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
const receipt = new URLSearchParams(location.hash.slice(1));
const returned = new URLSearchParams(location.search).get('order');
const receiptId = receipt.get('order');
const receiptToken = receipt.get('token');
if (idPattern.test(receiptId) && tokenPattern.test(receiptToken)) {
  const saved = restore(`${key}-${receiptId}`);
  order = saved?.token === receiptToken ? saved : {id:receiptId, token:receiptToken};
  try { save(); } catch { /* The supplied order link still works for this visit. */ }
} else {
  order = returned ? restore(`${key}-${returned}`) : restore(key);
}
if (!tokenPattern.test(order?.token) || (order.id && !idPattern.test(order.id))) order = undefined;
if (returned || receiptId || receiptToken) {
  history.replaceState(null, '', '/aud-r/#buy');
  document.querySelector('#buy').scrollIntoView();
}
if (order?.id) {
  feedback.textContent = '正在确认订单…';
  subscribe();
  if (returned) checkOrder();
} else if (returned) {
  feedback.textContent = '本浏览器找不到这笔订单。请使用付款前的浏览器或已保存的订单链接。';
}
refreshButtons();
try {
  const response = await fetch(api + '/config', {signal:AbortSignal.timeout(10000)});
  const config = await response.json();
  ready = response.ok && config.amount_fen === 990;
} catch { ready = false; }
if (!order?.id && !returned) feedback.textContent = ready ? '一次性支付。付款确认后即可下载。' : '购买服务暂不可用，请稍后重试。';
refreshButtons();
