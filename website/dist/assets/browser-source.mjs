import {requestService} from './config.mjs';
import {mountCheckout} from './alipay-checkout.mjs';

const versionPattern = /^\d+\.\d+\.\d+$/;

if (requestService.enabled) {
  const api = new URL('/v1/store/browser-source', requestService.origin).href;
  const product = await fetch(api + '/config', {signal:AbortSignal.timeout(10000)})
    .then(response => response.ok ? response.json() : null)
    .catch(() => null);
  if (product?.page === location.pathname && versionPattern.test(product.version) &&
      Number.isSafeInteger(product.amount_fen) && product.amount_fen > 0) {
    document.querySelector('#price').textContent = '¥' + (product.amount_fen / 100).toFixed(2);
    mountCheckout({
      api,
      page: product.page,
      key: 'audcore-browser-source-order',
      versionPattern,
      paidMessage: version => '已付款，可以下载 Web-out v' + version + '。请保存订单链接。',
      filename: version => 'Web-out-v' + version + '.vst3',
      downloadType: 'application/octet-stream',
      downloadOnPayment: true,
    });
  }
}
