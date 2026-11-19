import test from 'node:test';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {mountCheckout} from '../dist/assets/alipay-checkout.mjs';

const id = 'AUD' + 'a'.repeat(32);
const token = 'b'.repeat(64);
const api = 'https://example.test/checkout';
const options = {
  api, page:'/', key:'order', paidMessage:'paid', filename:() => 'plugins.zip',
  versionPattern:/^\d+\.\d+\.\d+\+\d+\.\d+\.\d+$/,
};
const version = '1.29.0+1.22.0';
const order = {id, token};
const saved = value => [['order',JSON.stringify(value)], ['order-'+id,JSON.stringify(value)]];

function page(t, {records = [], pathname = '/', query = '', hash = '', request} = {}) {
  const elements = new Map();
  const storage = new Map(records);
  const calls = [];
  const element = () => ({
    addEventListener(name, callback) { this[name] = callback; },
    append() {}, remove() {}, scrollIntoView() {}, submit() {},
  });
  const document = {
    ...element(), hidden:false, body:element(), createElement:element,
    querySelector(selector) {
      if (!elements.has(selector)) elements.set(selector,element());
      return elements.get(selector);
    },
  };
  const window = {...element(), open:() => null};
  const location = {origin:'https://example.test', pathname, search:query, hash};
  const history = {replaceState() {}};
  const localStorage = {getItem:key => storage.get(key), setItem:(key,value) => storage.set(key,value)};
  const fetch = (url, params) => {
    calls.push({url,...params});
    assert.ok(request, 'opening a product page must not call the API');
    return request(url,params);
  };
  const globals = {document, window, location, history, localStorage, fetch};
  const originals = Object.fromEntries(Object.keys(globals).map(key => [key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  for (const [key,value] of Object.entries(globals))
    Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});
  t.after(() => {
    for (const [key,descriptor] of Object.entries(originals))
      if (descriptor) Object.defineProperty(globalThis,key,descriptor);
      else delete globalThis[key];
  });
  return {elements, storage, calls, document, window};
}

const cases = [
  ['first visit', {}, '支付宝购买'],
  ['unsubmitted request', {records:saved({token,request_id:'request'})}, '支付宝购买'],
  ['legacy pending order', {records:saved(order)}, '继续支付宝付款'],
  ['saved pending order', {records:saved({...order,status:'pending',version})}, '继续支付宝付款'],
  ['saved paid order', {records:saved({...order,status:'paid',version})}, '下载 VST3'],
  ['cashier return with paid record', {records:saved({...order,status:'paid',version}),query:'?order='+id}, '下载 VST3'],
  ['order link without local record', {hash:'#order='+id+'&token='+token}, '继续支付宝付款'],
  ['order link with paid record', {records:saved({...order,status:'paid',version}),hash:'#order='+id+'&token='+token}, '下载 VST3'],
];

for (const [name,init,label] of cases) {
  for (const [product, productOptions] of [
    ['compressors',options],
    ['Aud-R',{...options, key:'order', page:'/aud-r/', versionPattern:/^\d+\.\d+\.\d+$/}],
  ]) test(`${product} ${name}: opening, returning and restoring make zero API calls`, async t => {
    const setup = product === 'Aud-R' && init.records ? {
      ...init, records:init.records.map(([key,value]) => [key,value.replace(version,'1.14.0')]),
    } : init;
    const browser = page(t,setup);
    mountCheckout(productOptions);
    browser.window.pageshow?.({persisted:true});
    browser.document.visibilitychange?.();
    assert.equal(browser.elements.get('#checkout').textContent,label);
    assert.deepEqual(browser.calls,[]);
  });
}

test('explicit purchase waits for a paid notification and persists the version immediately', async t => {
  const browser = page(t,{request:async url => {
    if (url.endsWith('/orders')) return Response.json({
      id,status:'pending',version,payment:{gateway_url:'https://openapi.alipay.com/gateway.do',fields:{}},
    });
    assert.equal(url,api+'/events?order='+id);
    return new Response(`data: ${JSON.stringify({order:{id,status:'paid',version}})}\n\n`);
  }});
  mountCheckout(options);
  await browser.elements.get('#checkout').click();
  for (let i = 0; i < 10 && JSON.parse(browser.storage.get('order')).status !== 'paid'; ++i)
    await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(browser.calls.map(c => c.url),[api+'/orders',api+'/events?order='+id]);
  assert.equal(JSON.parse(browser.storage.get('order')).status,'paid');
  assert.equal(JSON.parse(browser.storage.get('order-'+id)).version,version);
  assert.equal(browser.elements.get('#checkout').textContent,'下载 VST3');
});

test('confirming a recovered order requires a click and authenticates with its saved token', async t => {
  const browser = page(t,{hash:'#order='+id+'&token='+token,request:async () => Response.json({id,status:'paid',version})});
  mountCheckout(options);
  await browser.elements.get('#check-order').click();
  assert.equal(browser.calls.length,1);
  assert.equal(browser.calls[0].url,api+'/orders/'+id+'/reconcile');
  assert.equal(browser.calls[0].headers.Authorization,'Bearer '+token);
  assert.equal(JSON.parse(browser.storage.get('order')).status,'paid');
});

test('Music-in downloads one raw VST3 when payment changes from pending to paid', async t => {
  const musicVersion = '0.1.0';
  const links = [];
  const browser = page(t, {
    records: saved({...order, status:'pending', version:musicVersion}),
    request: async url => {
      if (url.endsWith('/reconcile')) return Response.json({id,status:'paid',version:musicVersion});
      assert.equal(url,api+'/orders/'+id+'/download');
      return new Response('VST3 bytes', {headers:{'Content-Type':'application/octet-stream'}});
    },
  });
  browser.document.createElement = name => {
    assert.equal(name,'a');
    return {click() { links.push(this.download); }, remove() {}};
  };
  t.mock.method(globalThis,'setTimeout',callback => { callback(); return 0; });
  mountCheckout({
    ...options, page:'/music-in/', versionPattern:/^\d+\.\d+\.\d+$/,
    filename:() => 'Music-in.vst3', downloadType:'application/octet-stream', downloadOnPayment:true,
  });
  await browser.elements.get('#check-order').click();
  for (let i = 0; i < 10 && !links.length; ++i) await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(browser.calls.map(call => call.url),[
    api+'/orders/'+id+'/reconcile', api+'/orders/'+id+'/download',
  ]);
  assert.deepEqual(links,['Music-in.vst3']);
  assert.equal(browser.elements.get('#checkout').textContent,'下载 VST3');
});

test('Music-in official entry restores a real version and enables checkout without a config request', async t => {
  const musicVersion = '0.1.0';
  const browser = page(t, {
    records: [['audcore-music-in-order', JSON.stringify({...order, version:musicVersion, status:'paid'})]],
  });
  await import('../dist/assets/music-in.mjs');
  assert.equal(browser.elements.get('#checkout').textContent,'下载 VST3');
  assert.equal(browser.elements.get('#checkout').disabled,false);
  assert.match(browser.elements.get('#order-status').textContent,/Music-in v0\.1\.0/);
  assert.deepEqual(browser.calls,[]);
});

function sharedStore(t, product, options) {
  const browser = page(t, {pathname:`/${product}/`, ...options});
  const html = readFileSync(new URL(`../dist/${product}/index.html`, import.meta.url), 'utf8');
  const match = html.match(/data-vst3-store="([^"]+)"/);
  assert.ok(match && html.includes('/assets/vst3-store.mjs'));
  browser.document.querySelector('#buy').dataset = {vst3Store:match[1]};
  return browser;
}

test('Web-out 与 Aud-R 使用同一入口，打开时启用购买且零请求', async t => {
  const browser = sharedStore(t, 'web-out');
  browser.document.querySelector('#checkout').disabled = true;
  await import('../dist/assets/vst3-store.mjs?web-out-first-visit');
  assert.equal(browser.elements.get('#checkout').disabled,false);
  assert.equal(browser.elements.get('#checkout').textContent,'支付宝购买');
  assert.deepEqual(browser.calls,[]);
});

test('Aud-R 保留旧订单键和继续付款行为，恢复时零请求', async t => {
  const browser = sharedStore(t, 'aud-r', {
    records:[['audcore-aud-r-order', JSON.stringify({...order,status:'pending',version:'1.14.0'})]],
  });
  await import('../dist/assets/vst3-store.mjs?aud-r-pending');
  assert.equal(browser.elements.get('#checkout').textContent,'继续付款');
  assert.equal(browser.elements.get('#copy-order').hidden,true);
  assert.deepEqual(browser.calls,[]);
});

test('Web-out 确认到账后按订单版本下载单文件，恢复时零请求', async t => {
  const pendingVersion = '0.1.2';
  const links = [];
  const browser = sharedStore(t, 'web-out', {
    records:[['audcore-browser-source-order', JSON.stringify({...order,status:'pending',version:pendingVersion})]],
    request:async url => {
      if (url.endsWith('/reconcile')) return Response.json({id,status:'paid',version:pendingVersion});
      assert.ok(url.endsWith('/orders/'+id+'/download'));
      return new Response('VST3 bytes', {headers:{'Content-Type':'application/octet-stream'}});
    },
  });
  browser.document.createElement = name => {
    assert.equal(name,'a');
    return {click() { links.push(this.download); }, remove() {}};
  };
  t.mock.method(globalThis,'setTimeout',callback => { callback(); return 0; });
  await import('../dist/assets/vst3-store.mjs?web-out-pending');
  assert.equal(browser.elements.get('#checkout').textContent,'继续支付宝付款');
  assert.deepEqual(browser.calls,[]);
  await browser.elements.get('#check-order').click();
  for (let i = 0; i < 10 && !links.length; ++i) await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(links,['Web-out-v0.1.2.vst3']);
  assert.deepEqual(browser.calls.map(call => call.url.split('/').at(-1)),['reconcile','download']);
});

test('缓存的 Web-out 页面使用旧脚本地址时也能启用购买，打开时零请求', async t => {
  const browser = page(t, {pathname:'/web-out/'});
  await import('../dist/assets/browser-source.mjs');
  assert.equal(browser.elements.get('#checkout').disabled,false);
  assert.deepEqual(browser.calls,[]);
});

test('AudEQP1A 确认到账后按订单版本下载单文件，恢复时零请求', async t => {
  const pendingVersion = '0.1.6';
  const links = [];
  const browser = sharedStore(t, 'aud-eqp1a', {
    records:[['audcore-aud-eqp1a-order', JSON.stringify({...order,status:'pending',version:pendingVersion})]],
    request:async url => {
      if (url.endsWith('/reconcile')) return Response.json({id,status:'paid',version:pendingVersion});
      assert.ok(url.endsWith('/orders/'+id+'/download'));
      return new Response('VST3 bytes', {headers:{'Content-Type':'application/octet-stream'}});
    },
  });
  browser.document.createElement = name => {
    assert.equal(name,'a');
    return {click() { links.push(this.download); }, remove() {}};
  };
  t.mock.method(globalThis,'setTimeout',callback => { callback(); return 0; });
  await import('../dist/assets/vst3-store.mjs?aud-eqp1a-pending');
  assert.equal(browser.elements.get('#checkout').textContent,'继续支付宝付款');
  assert.deepEqual(browser.calls,[]);
  await browser.elements.get('#check-order').click();
  for (let i = 0; i < 10 && !links.length; ++i) await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(links,['AudEQP1A-v0.1.6.vst3']);
  assert.deepEqual(browser.calls.map(call => call.url.split('/').at(-1)),['reconcile','download']);
});


test('AudEQ6 新页面沿用共用结账，首次打开零请求', async t => {
  const browser = sharedStore(t, 'aud-eq6');
  browser.document.querySelector('#checkout').disabled = true;
  await import('../dist/assets/vst3-store.mjs?aud-eq6-first');
  assert.equal(browser.elements.get('#checkout').disabled,false);
  assert.equal(browser.elements.get('#checkout').textContent,'支付宝购买');
  assert.deepEqual(browser.calls,[]);
});

test('AudEQ6 确认到账后按订单实际版本下载单文件，恢复时零请求', async t => {
  const pendingVersion = '0.1.33';
  const links = [];
  const browser = sharedStore(t, 'aud-eq6', {
    records:[['audcore-aud-eq6-order', JSON.stringify({...order,status:'pending',version:pendingVersion})]],
    request:async url => {
      if (url.endsWith('/reconcile')) return Response.json({id,status:'paid',version:pendingVersion});
      assert.ok(url.endsWith('/orders/'+id+'/download'));
      return new Response('VST3 bytes', {headers:{'Content-Type':'application/octet-stream'}});
    },
  });
  browser.document.createElement = name => {
    assert.equal(name,'a');
    return {click() { links.push(this.download); }, remove() {}};
  };
  t.mock.method(globalThis,'setTimeout',callback => { callback(); return 0; });
  await import('../dist/assets/vst3-store.mjs?aud-eq6-pending');
  assert.deepEqual(browser.calls,[]);
  await browser.elements.get('#check-order').click();
  for (let i = 0; i < 10 && !links.length; ++i) await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(links,['AudEQ6-v0.1.33.vst3']);
  assert.deepEqual(browser.calls.map(call => call.url.split('/').at(-1)),['reconcile','download']);
  assert.ok(browser.calls.every(call=>new URL(call.url).pathname.startsWith('/v1/store/aud-eq6/')));
});

test('面向用户的金额保留必要小数，不改变原始分值', async () => {
  const {formatMoney} = await import('../dist/assets/money.mjs');
  for (const [fen,label] of [[0,'¥0'],[1,'¥0.01'],[10,'¥0.1'],[100,'¥1'],[990,'¥9.9'],[999,'¥9.99'],[1000,'¥10'],[1010,'¥10.1'],[12345,'¥123.45']]) {
    assert.equal(formatMoney(fen),label);
  }
});

test('Aud550 组合页明确两款 ¥9.9，首次打开及恢复时零请求', async t => {
  const html = readFileSync(new URL('../dist/aud-550/index.html', import.meta.url), 'utf8');
  assert.ok(html.includes('一次购买包含 Aud550A 和 Aud550B'));
  assert.ok(html.includes('¥9.9') && !html.includes('¥9.90'));
  assert.ok(html.includes('/assets/aud550a-panel.png') && html.includes('/assets/aud550b-panel.png'));
  const browser = sharedStore(t, 'aud-550');
  browser.document.querySelector('#checkout').disabled = true;
  await import('../dist/assets/vst3-store.mjs?aud550-first');
  browser.window.pageshow?.({persisted:true});
  browser.document.visibilitychange?.();
  assert.equal(browser.elements.get('#checkout').disabled,false);
  assert.equal(browser.elements.get('#checkout').textContent,'支付宝购买');
  assert.deepEqual(browser.calls,[]);
});

test('Aud550 已购订单回跳只恢复本地状态，不请求商品配置', async t => {
  const paidVersion = '1.4.0';
  const browser = sharedStore(t, 'aud-550', {
    records:[
      ['audcore-aud-550-order', JSON.stringify({...order,status:'paid',version:paidVersion})],
      ['audcore-aud-550-order-'+id, JSON.stringify({...order,status:'paid',version:paidVersion})],
    ],
    query:'?order='+id,
  });
  await import('../dist/assets/vst3-store.mjs?aud550-paid-return');
  assert.equal(browser.elements.get('#checkout').textContent,'下载 VST3');
  assert.deepEqual(browser.calls,[]);
});

test('Aud550 确认到账后手动下载订单版本的 ZIP，不重复下单', async t => {
  const paidVersion = '1.4.0';
  const links = [];
  const browser = sharedStore(t, 'aud-550', {
    records:[['audcore-aud-550-order', JSON.stringify({...order,status:'pending',version:paidVersion})]],
    request:async url => {
      if (url.endsWith('/reconcile')) return Response.json({id,status:'paid',version:paidVersion});
      assert.ok(url.endsWith('/orders/'+id+'/download'));
      return new Response('Aud550A + Aud550B ZIP bytes', {headers:{'Content-Type':'application/zip'}});
    },
  });
  browser.document.createElement = name => {
    assert.equal(name,'a');
    return {click() { links.push(this.download); }, remove() {}};
  };
  t.mock.method(globalThis,'setTimeout',callback => { callback(); return 0; });
  await import('../dist/assets/vst3-store.mjs?aud550-zip');
  assert.deepEqual(browser.calls,[]);
  await browser.elements.get('#check-order').click();
  assert.deepEqual(links,[]);
  assert.deepEqual(browser.calls.map(call => call.url.split('/').at(-1)),['reconcile']);
  assert.equal(browser.elements.get('#checkout').textContent,'下载 VST3');
  await browser.elements.get('#checkout').click();
  assert.deepEqual(links,['Aud550-v1.4.0-vst3-win-x64.zip']);
  assert.deepEqual(browser.calls.map(call => call.url.split('/').at(-1)),['reconcile','download']);
  assert.ok(browser.calls.every(call => new URL(call.url).pathname.startsWith('/v1/store/aud-550/')));
});
