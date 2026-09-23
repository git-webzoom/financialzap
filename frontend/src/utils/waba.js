/**
 * Rótulo de exibição de uma WABA: nome + 4 últimos dígitos do ID,
 * para diferenciar WABAs com o mesmo nome. Ex.: "Financial (…1234)"
 */
export function wabaLabel(name, wabaId) {
  const id = wabaId ? String(wabaId) : ''
  if (!name) return id
  return id ? `${name} (…${id.slice(-4)})` : name
}
