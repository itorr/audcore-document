import {mountCheckout} from './alipay-checkout.mjs';

const versionPattern = /^(\d+\.\d+\.\d+)\+(\d+\.\d+\.\d+)$/;

function versions(value) {
  const match = versionPattern.exec(value);
  if (!match) return false;
  document.querySelector('#version-aud2a').textContent = `v${match[1]} · VST3`;
  document.querySelector('#version-aud76').textContent = `v${match[2]} · VST3`;
  return true;
}

mountCheckout({
  api:'https://aud-api.utae.cn/v1/store/compressors',
  page:'/',
  key:'audcore-compressors-order',
  versionPattern,
  paidMessage:'已确认到账，可下载 Aud2A 和 Aud76。请保存订单链接以便再次下载。',
  filename(version) {
    const [, aud2a, aud76] = versionPattern.exec(version);
    return `Aud2A-v${aud2a}-Aud76-v${aud76}-vst3-win-x64.zip`;
  },
  downloadLabel:'下载两款 VST3',
  onVersion:versions,
});
