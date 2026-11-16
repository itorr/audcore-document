import {requestService} from './config.mjs';
import {mountCheckout} from './alipay-checkout.mjs';

const api = new URL('/v1/store/music-in', requestService.origin).href;
const versionPattern = /^d+.d+.d+$/;
const status = document.querySelector('#order-status');

try {
  if (!requestService.enabled) throw new Error();
  const response = await fetch(api + '/config', {signal: AbortSignal.timeout(8000)});
  if (!response.ok) throw new Error();
  const product = await response.json();
  if (!versionPattern.test(product.version) || product.amount_fen !== 990) throw new Error();
  mountCheckout({
    api,
    page: '/music-in/',
    key: 'audcore-music-in-order',
    versionPattern,
    paidMessage: version => `已付款，可以下载 Music-in v${version}。请保存订单链接。`,
    filename: () => 'Music-in.vst3',
    downloadType: 'application/octet-stream',
    downloadOnPayment: true,
  });
} catch {
  status.textContent = 'VST3 购买暂未开放。';
}
