import test from 'node:test';
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

test('网页源商品页只在服务器已启用当前正式路径时开放购买', async t => {
  const browser = page(t, {
    pathname:'/web-out/',
    request:async () => new Response(null, {status:503}),
  });
  browser.document.querySelector('#checkout').disabled = true;
  await import('../dist/assets/browser-source.mjs?disabled');
  assert.equal(browser.elements.get('#checkout').disabled,true);
  assert.equal(browser.calls.length,1);
  assert.ok(browser.calls[0].url.endsWith('/v1/store/browser-source/config'));
});

test('网页源商品页显示配置价格，恢复订单并按订单版本下载单个 VST3', async t => {
  const pathname = '/configured-product/';
  const pendingVersion = '0.1.0';
  const links = [];
  const browser = page(t, {
    pathname,
    records:[['audcore-browser-source-order', JSON.stringify({...order,status:'pending',version:pendingVersion})]],
    request:async url => {
      if (url.endsWith('/config')) return Response.json({page:pathname,version:'0.2.0',amount_fen:1250});
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
  await import('../dist/assets/browser-source.mjs?enabled');
  assert.equal(browser.elements.get('#price').textContent,'¥12.50');
  assert.equal(browser.elements.get('#checkout').textContent,'继续支付宝付款');
  assert.equal(browser.calls.length,1);
  await browser.elements.get('#check-order').click();
  for (let i = 0; i < 10 && !links.length; ++i) await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(links,['Browser-Source-v0.1.0.vst3']);
});