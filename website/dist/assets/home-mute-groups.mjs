// A letter identifies an exclusive family; its number identifies a linked set.
export function normalizeMuteGroup(value) {
  const match = /^([A-Z])(\d+)$/.exec(String(value || '').trim().toUpperCase());
  return match ? match[1] + match[2] : null;
}

export function muteGroupChanges(chains, source, mute) {
  const group = normalizeMuteGroup(source.muteGroup);
  return chains.flatMap(chain => {
    const peer = normalizeMuteGroup(chain.muteGroup);
    if (chain.id === source.id || (group && peer === group)) return [{chain, mute}];
    if (!mute && group && peer && peer[0] === group[0]) return [{chain, mute:true}];
    return [];
  }).filter(change => !!change.chain.mute !== change.mute)
    // Silence competing sets before enabling the selected one.
    .sort((a, b) => Number(b.mute) - Number(a.mute));
}
