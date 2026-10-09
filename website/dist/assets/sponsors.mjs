import {requestService} from './config.mjs';
const api = requestService.origin;
const form = document.querySelector('#sponsor-form');
const feedback = document.querySelector('#sponsor-feedback');
const list = document.querySelector('#sponsor-list');
const listStatus = document.querySelector('#sponsor-list-status');
const fullRecords = document.body.hasAttribute('data-sponsor-records');
const money = fen => `¥${(fen/100).toFixed(2)}`;
let events, pending, page = 1, total = 0;
const storage = {
  get(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} },
};
const params = new URLSearchParams(location.search);
const returnId = params.get('sponsor_order');
pending = storage.get(returnId ? `audcore-sponsor-${returnId}` : 'audcore-sponsor-pending');
function render(items, count) {
  total = count;
  list.replaceChildren(...items.map(item => {
    const li = document.createElement('li');
    const head = document.createElement('div'); head.className = 'sponsor-record-head';
    const name = document.createElement('strong'); name.textContent = item.name;
    const amount = document.createElement('span'); amount.textContent = money(item.amount_fen);
    const time = document.createElement('time'); time.dateTime = item.paid_at;
    time.textContent = new Intl.DateTimeFormat('zh-CN', {year:'numeric', month:'2-digit', day:'2-digit'}).format(new Date(item.paid_at));
    head.append(name, amount); li.append(head, time);
    if (item.message) { const p = document.createElement('p'); p.textContent = item.message; li.append(p); }
    return li;
  }));
  listStatus.textContent = count ? `已收到 ${count} 次支持，谢谢你们。` : '还没有赞助记录，感谢每一份支持。';
  if (fullRecords) {
    document.querySelector('#sponsor-page').textContent = `第 ${page} / ${Math.max(1, Math.ceil(total/30))} 页`;
    document.querySelector('#sponsor-prev').disabled = page <= 1;
    document.querySelector('#sponsor-next').disabled = page * 30 >= total;
  }
}
async function request(path, options) {
  const response = await fetch(new URL(path, api), {...options, signal:AbortSignal.timeout(20000)});
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || '暂时无法连接，请稍后重试');
  return result;
}
function paymentStatus(status) {
  if (!feedback) return;
  if (status === 'paid') {
    feedback.textContent = '赞助已到账，谢谢你的支持！';
    pending = undefined; storage.set('audcore-sponsor-pending', null);
    events?.close(); events = undefined;
    document.querySelector('#sponsor-check').hidden = true;
  } else if (status === 'closed') {
    feedback.textContent = '这笔支付已关闭，可以重新发起赞助。';
    pending = undefined; storage.set('audcore-sponsor-pending', null);
    events?.close(); events = undefined;
    document.querySelector('#sponsor-check').hidden = true;
  }
}
function subscribe() {
  if (!form || !pending?.id || document.hidden) return;
  events?.close();
  const url = new URL('/v1/sponsors/events', api);
  if (pending?.id) { url.searchParams.set('order', pending.id); url.searchParams.set('token', pending.token); }
  events = new EventSource(url);
  events.onmessage = event => {
    try {
      const result = JSON.parse(event.data);
      if (result.order) paymentStatus(result.order.status);
    } catch { listStatus.textContent = '记录暂时无法显示，请刷新重试。'; }
  };
  events.onerror = () => { feedback.textContent = '到账通知连接暂时中断，正在重连…'; };
}
let records;
async function loadPage(preview = false) {
  try {
    records ??= fetch('/data/sponsors.json').then(async response => {
      if (!response.ok) throw new Error('记录暂时无法显示，请稍后重试');
      const result = await response.json();
      if (!Array.isArray(result.items) || result.total !== result.items.length) throw new Error('记录格式不正确');
      return result;
    }).catch(error => { records = undefined; throw error; });
    const result = await records;
    const limit = preview ? 6 : 30;
    render(result.items.slice((page-1)*limit, page*limit), result.total);
  } catch (error) { listStatus.textContent = error.message; }
}
if (fullRecords) {
  document.querySelector('#sponsor-prev').addEventListener('click', () => { if (page > 1) { page--; loadPage(); } });
  document.querySelector('#sponsor-next').addEventListener('click', () => { if (page*30 < total) { page++; loadPage(); } });
  document.querySelector('#sponsor-refresh').addEventListener('click', () => { records = undefined; loadPage(); });
  loadPage();
} else if (form) {
  const submit = form.querySelector('button[type="submit"]');
  const custom = form.elements.custom_amount;
  const count = document.querySelector('#sponsor-message-count');
  function update() {
    const isCustom = form.elements.amount.value === 'custom';
    document.querySelector('#sponsor-custom').hidden = !isCustom;
    custom.required = isCustom; custom.disabled = !isCustom;
    for (const [field, max] of [[form.elements.name,20], [form.elements.message,60]]) {
      field.setCustomValidity([...field.value.trim()].length > max ? `最多 ${max} 字` : '');
    }
    count.textContent = `${[...form.elements.message.value].length} / 60 字`;
  }
  form.addEventListener('input', update); update();
  submit.disabled = !requestService.enabled;
  feedback.textContent = '付款后，名字和留言会公开展示；留空名字则匿名。';
  form.addEventListener('submit', async event => {
    event.preventDefault(); update();
    if (!requestService.enabled || submit.disabled || !form.reportValidity()) return;
    const amount = form.elements.amount.value === 'custom' ? custom.value : form.elements.amount.value;
    const input = {amount, name:form.elements.name.value.trim(), message:form.elements.message.value.trim()};
    if (!pending?.request || ['amount','name','message'].some(k => pending.request[k] !== input[k])) {
      pending = {token:[...crypto.getRandomValues(new Uint8Array(32))].map(v => v.toString(16).padStart(2,'0')).join(''), request:{...input, request_id:crypto.randomUUID()}};
      storage.set('audcore-sponsor-pending', pending);
    }
    const target = 'audcore_sponsor_' + crypto.randomUUID().replaceAll('-', '');
    const popup = window.open('about:blank', target);
    if (!popup) { feedback.textContent = '请允许本站打开支付窗口，再点击支付宝赞助。'; return; }
    popup.opener = null;
    submit.disabled = true; feedback.textContent = '正在准备支付宝支付…';
    try {
      const result = await request('/v1/sponsors/orders', {method:'POST', headers:{'Content-Type':'application/json', Authorization:`Bearer ${pending.token}`}, body:JSON.stringify(pending.request)});
      const gateway = new URL(result.payment.gateway_url);
      if (gateway.href !== 'https://openapi.alipay.com/gateway.do' || result.token !== pending.token) throw new Error('支付信息无效，请重试');
      pending.id = result.id;
      storage.set('audcore-sponsor-pending', pending); storage.set(`audcore-sponsor-${pending.id}`, pending);
      subscribe();
      gateway.searchParams.set('charset', 'utf-8');
      const payForm = document.createElement('form'); payForm.method = 'POST'; payForm.acceptCharset = 'UTF-8'; payForm.action = gateway.href; payForm.target = target; payForm.hidden = true;
      for (const [name, value] of Object.entries(result.payment.fields)) {
        if (name === 'charset') continue;
        const input = document.createElement('input'); input.type = 'hidden'; input.name = name; input.value = value; payForm.append(input);
      }
      document.body.append(payForm); payForm.submit(); payForm.remove();
      feedback.textContent = '请在支付宝窗口完成付款，到账后这里会自动更新。';
      document.querySelector('#sponsor-check').hidden = false;
    } catch (error) { popup.close(); feedback.textContent = error.message; }
    finally { submit.disabled = !requestService.enabled; }
  });
  async function check() {
    if (!pending?.id) return;
    const button = document.querySelector('#sponsor-check'); button.disabled = true;
    try {
      const result = await request(`/v1/sponsors/orders/${pending.id}/reconcile`, {method:'POST', headers:{'Content-Type':'application/json', Authorization:`Bearer ${pending.token}`}, body:'{}'});
      paymentStatus(result.status);
      if (result.status === 'pending') feedback.textContent = '尚未确认到账。付款后会自动更新，也可以稍后再确认。';
    } catch (error) { feedback.textContent = error.message; }
    finally { button.disabled = false; }
  }
  document.querySelector('#sponsor-check').addEventListener('click', check);
  const start = () => {
    if (!document.hidden) {
      if (pending?.id && !events) subscribe();
    }
    else { events?.close(); events = undefined; }
  };
  loadPage(true); start();
  document.addEventListener('visibilitychange', start);
  addEventListener('pageshow', event => { if (event.persisted) start(); });
  if (pending?.id) document.querySelector('#sponsor-check').hidden = false;
  if (params.has('sponsor_return') && pending?.id) {
    check();
    history.replaceState(null, '', '/sponsor/');
  }
} else if (list) loadPage(true);
addEventListener('pagehide', () => { events?.close(); events = undefined; });
