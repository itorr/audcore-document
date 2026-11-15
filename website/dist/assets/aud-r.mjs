import {requestService} from './config.mjs';
import {mountCheckout} from './alipay-checkout.mjs';

mountCheckout({
  api:new URL('/v1/store/aud-r', requestService.origin).href,
  page:'/aud-r/',
  key:'audcore-aud-r-order',
  versionPattern:/^\d+\.\d+\.\d+$/,
  paidMessage:version => `付款已确认，可下载 Aud-R v${version}。订单链接可用于再次下载，请妥善保存。`,
  filename:version => `Aud-R-v${version}-vst3-win-x64.zip`,
});
