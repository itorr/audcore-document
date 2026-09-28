const releaseTarget = document.querySelector('#download-releases');
const commitTarget = document.querySelector('#commit-list');
const countTarget = document.querySelector('#commit-count');
const homeVersionTarget = document.querySelector('#home-latest-version');

function el(tag, value, className) {
  const node = document.createElement(tag);
  if (value != null) node.textContent = value;
  if (className) node.className = className;
  return node;
}
function validRelease(item) {
  if (!item || typeof item.version !== 'string' || !/^v\d+\.\d+\.\d+$/.test(item.version)) return false;
  if (typeof item.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(item.date)) return false;
  try {
    const url = new URL(item.url, location.origin);
    const stablePath = url.pathname === `/releases/${item.version}/audcore-setup-${item.version}.exe`;
    const locationIsSafe = (url.origin === location.origin && stablePath) || (url.protocol === 'https:' && url.origin !== location.origin);
    const validFile = file => file && typeof file.sha256 === 'string' && /^[0-9a-f]{64}$/i.test(file.sha256) && Number.isSafeInteger(file.size) && file.size > 0;
    const portable = item.portable;
    const portableValid = !portable || (validFile(portable) && new URL(portable.url, location.origin).origin === location.origin && new URL(portable.url, location.origin).pathname === `/releases/${item.version}/audcore-portable.exe`);
    return locationIsSafe && portableValid && validFile(item);
  } catch { return false; }
}
function sizeOf(bytes) { return (bytes / 1048576).toFixed(2) + ' MB'; }
function fileButton(label, description, file, primary) {
  const card = el('div', null, 'download-option');
  card.dataset.variant = primary ? 'primary' : 'secondary';
  const link = el('a', null, 'pill download-action');
  link.href = file.url;
  link.title = description;
  link.append(el('span', label, 'download-action-label'));
  card.append(link);
  const copy = el('button', 'SHA', 'download-sha');
  copy.type = 'button';
  copy.title = '点击复制 SHA-256';
  copy.setAttribute('aria-label', `复制${primary ? '安装包' : '单文件绿色版'} SHA-256`);
  const feedback = el('span', '', 'download-copy-feedback');
  feedback.setAttribute('role', 'status');
  let reset;
  copy.addEventListener('click', async () => {
    clearTimeout(reset);
    try {
      await navigator.clipboard.writeText(file.sha256);
      copy.dataset.copyState = 'copied';
      copy.textContent = '已复制';
      feedback.textContent = 'SHA-256 已复制';
    } catch {
      copy.dataset.copyState = 'failed';
      copy.textContent = '复制失败';
      copy.title = `复制失败，SHA-256：${file.sha256}`;
      feedback.textContent = `复制失败，SHA-256：${file.sha256}`;
    }
    reset = setTimeout(() => {
      delete copy.dataset.copyState;
      copy.textContent = 'SHA';
      copy.title = '点击复制 SHA-256';
      feedback.textContent = '';
    }, 2500);
  });
  const metadata = el('div', null, 'download-file-meta');
  metadata.append(el('span', sizeOf(file.size), 'download-file-size'), copy);
  card.append(metadata, feedback);
  return card;
}
function renderDownload(item) {
  const intro = el('div', null, 'download-version');
  intro.append(el('h2', `声核 ${item.version}`), el('p', `${item.date} 发布 · Windows 64 位`));
  releaseTarget.append(intro);
  const choices = el('div', null, 'download-choices');
  if (item.portable) {
    choices.append(
      fileButton('下载安装包', '推荐使用。安装到当前用户目录，提供快捷方式和卸载入口。', item, true),
      fileButton('下载单文件绿色版', '下载后可直接运行；设置与工作状态仍保存在当前用户目录。', item.portable, false),
    );
  } else {
    choices.append(fileButton('下载单文件版', '此历史版本仅提供单文件下载。', item, false));
  }
  releaseTarget.append(choices);
  const changes = el('section', null, 'download-changes');
  const heading = el('div', null, 'download-changes-heading');
  const history = el('a', '更新记录', 'text-link'); history.href = '/changelog/';
  heading.append(el('h2', '本版更新'), history); changes.append(heading);
  const items = Array.isArray(item.changes) ? item.changes.filter(value => typeof value === 'string' && value.trim()) : [];
  if (items.length) {
    const list = el('ul'); for (const change of items) list.append(el('li', change)); changes.append(list);
  } else if (typeof item.notes === 'string' && item.notes) {
    changes.append(el('p', item.notes));
  } else {
    changes.append(el('p', '查看更新记录。'));
  }
  (document.querySelector('#download-changes') || releaseTarget).append(changes);
}
let releases = [];
if (releaseTarget) {
  try {
    const response = await fetch('/releases/index.json', {cache:'no-store'});
    if (!response.ok) throw new Error();
    const catalog = await response.json();
    if (catalog.schema !== 1 || !Array.isArray(catalog.releases)) throw new Error();
    releaseTarget.replaceChildren();
    releases = catalog.releases.filter(validRelease);
    if (!releases.length) {
      releaseTarget.append(el('p','目前没有可公开下载的正式版本。内测构建不等于正式发布包。'));
    } else {
      const isDownloadPage = releaseTarget.id === 'download-releases';
      if (isDownloadPage) renderDownload(releases[0]);
      for (const item of isDownloadPage ? [] : releases) {
        const card = el('article',null,'release-entry');
        const size = sizeOf(item.size);
        card.append(el('h3',item.version),el('p',isDownloadPage ? size : item.date+' · '+size));
        if (!isDownloadPage && typeof item.notes === 'string' && item.notes) card.append(el('p',item.notes));
        const link = el('a', item.portable ? '下载安装包' : '下载 Windows 版', 'pill');
        link.href = item.url;
        card.append(link);
        if (!isDownloadPage) card.append(el('small','SHA-256 '+item.sha256));
        releaseTarget.append(card);
      }
    }
  } catch { releaseTarget.replaceChildren(el('p','发布记录暂时无法加载。')); }
}
if (homeVersionTarget) {
  try {
    const response = await fetch('/releases/index.json', {cache:'no-store'});
    if (!response.ok) throw new Error();
    const catalog = await response.json();
    const latest = catalog.releases?.find(item => item.version === catalog.latest && validRelease(item));
    if (latest) homeVersionTarget.textContent = `${latest.version} 抢先体验版 · ${latest.portable ? '安装包 ' : ''}${sizeOf(latest.size)}`;
  } catch { /* Keep the link to the download page available. */ }
}
if (commitTarget) {
  try {
    const response = await fetch('/data/history-summaries.json', {cache:'no-store'});
    if (!response.ok) throw new Error();
    const history = await response.json();
    if (history.schema !== 2 || !history.days || typeof history.days !== 'object') throw new Error();
    const days = Object.entries(history.days)
      .filter(([day, summary]) => /^\d{4}-\d{2}-\d{2}$/.test(day) && Array.isArray(summary.items))
      .sort(([a], [b]) => b.localeCompare(a));
    countTarget.textContent = `${days.length} 个日期的更新`;
    commitTarget.replaceChildren();
    for (const [day, summary] of days) {
      const list = el('ul', null, 'commit-summary');
      for (const item of summary.items) {
        if (typeof item === 'string' && item.trim()) list.append(el('li', item));
      }
      if (list.childElementCount) commitTarget.append(el('h3', day, 'commit-day'), list);
    }
  } catch {
    countTarget.textContent = '暂时无法加载';
    commitTarget.replaceChildren(el('p', '更新记录暂时无法加载。'));
  }
}
