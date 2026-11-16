import {requestService} from './config.mjs';
import {mountCheckout} from './alipay-checkout.mjs';

// These are static product declarations. The order service owns the actual price,
// version, and payment status. Opening a page only restores browser-local state.
const products = new Map([
  ['aud-r', {
    page: '/aud-r/',
    name: 'Aud-R',
    file: 'Aud-R-v{version}-vst3-win-x64.zip',
    pendingLabel: '继续付款',
    copyPending: false,
    paidText: '已付款 · Aud-R v{version}',
  }],
  ['browser-source', {
    page: '/web-out/',
    name: 'Web-out',
    file: 'Web-out-v{version}.vst3',
  }],
]);

export function mountVst3Store(id) {
  const product = products.get(id);
  if (!requestService.enabled || !product) return;
  const singleFile = product.file.endsWith('.vst3');
  const paidText = product.paidText ?? `已付款，可以下载 ${product.name} v{version}。请保存订单链接。`;
  mountCheckout({
    api: new URL('/v1/store/' + id, requestService.origin).href,
    page: product.page,
    key: `audcore-${id}-order`,
    versionPattern: /^\d+\.\d+\.\d+$/,
    pendingLabel: product.pendingLabel,
    copyPending: product.copyPending,
    paidMessage: version => paidText.replace('{version}', version),
    filename: version => product.file.replace('{version}', version),
    downloadType: singleFile ? 'application/octet-stream' : 'application/zip',
    downloadOnPayment: singleFile,
  });
}

const productId = document.querySelector('#buy')?.dataset?.vst3Store;
if (productId) mountVst3Store(productId);
