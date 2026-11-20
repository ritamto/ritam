const B = import.meta.env.BASE_URL + 'api'
export async function call(path: string, body?: unknown) {
  const r = await fetch(B + path, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : undefined)
  if (r.status === 304) return null
  const j = await r.json(); if (!r.ok) throw Object.assign(new Error(j.error || 'error'), { status: r.status }); return j
}
