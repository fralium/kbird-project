export function findMatchedAlias(bird, rawSearch) {
  const q = String(rawSearch || '').trim();
  if (!q) return '';
  const aliases = Array.isArray(bird?.nameAliases) ? bird.nameAliases : [];
  const exact = aliases.find((alias) => String(alias) === q);
  if (exact) return exact;
  return aliases.find((alias) => String(alias).includes(q)) || '';
}
