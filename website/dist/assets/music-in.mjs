import {requestService} from './config.mjs';
import {mountCheckout} from './alipay-checkout.mjs';

if (requestService.enabled) {
  mountCheckout({
    api: new URL('/v1/store/music-in', requestService.origin).href,
    page: '/music-in/',
    key: 'audcore-music-in-order',
    versionPattern: /^\d+\.\d+\.\d+$/,
    paidMessage: version => '已付款，可以下载 Music-in v' + version + '。请保存订单链接。',
    filename: () => 'Music-in.vst3',
    downloadType: 'application/octet-stream',
    downloadOnPayment: true,
  });
}
