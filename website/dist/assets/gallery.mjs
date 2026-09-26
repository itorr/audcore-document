const list = document.querySelector('#chain-list');
const status = document.querySelector('#gallery-status');
export function importUri(item) {
  if (item?.status !== 'approved' || (item.kind && item.kind !== 'route')) return null;
  return typeof item.token === 'string' && /^(?:[a-f0-9]{32}|[a-f0-9]{64})$/i.test(item.token)
    ? 'audcore://import/share/' + item.token.toLowerCase() : null;
}
try {
  const response = await fetch('/gallery/index.json');
  if (!response.ok) throw new Error();
  const catalog = await response.json();
  const items = catalog.schema === 1 ? catalog.items : null;
  if (!Array.isArray(items)) throw new Error();
  for (const item of items) {
    const uri = importUri(item);
    if (!uri) continue;
    const card = document.createElement('article');
    const title = document.createElement('h2');
    title.textContent = typeof item.title === 'string' ? item.title.slice(0, 256) : '未命名效果链';
    const notes = document.createElement('p');
    notes.textContent = typeof item.notes === 'string' ? item.notes.slice(0, 1000) : '';
    const link = document.createElement('a');
    link.className = 'text-link';
    link.href = uri;
    link.textContent = '在声核中打开';
    card.append(title, notes, link);
    list.append(card);
  }
  status.hidden = list.childElementCount > 0;
} catch {
  status.textContent = '效果链列表暂时无法加载，请稍后重试。';
}