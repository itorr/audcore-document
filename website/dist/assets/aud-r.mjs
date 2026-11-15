import {requestService} from './config.mjs';
import {mountCheckout} from './alipay-checkout.mjs';

mountCheckout({
  api:new URL('/v1/store/aud-r', requestService.origin).href,
  page:'/aud-r/',
  key:'audcore-aud-r-order',
  versionPattern:/^\d+\.\d+\.\d+$/,
  pendingLabel:'继续付款',
  copyPending:false,
  paidMessage:version => `已付款 · Aud-R v${version}`,
  filename:version => `Aud-R-v${version}-vst3-win-x64.zip`,
});
