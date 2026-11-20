// The AI only narrates public log lines. It never sees hidden state or controls rules.
export class Budget {
  global = 0; rooms = new Map<string, number>()
  constructor(public maxGlobal: number, public maxRoom: number) {}
  allow(room: string) { return this.maxGlobal > 0 && this.global < this.maxGlobal && (this.rooms.get(room) ?? 0) < this.maxRoom }
  spend(room: string, tokens: number) { this.global += tokens; this.rooms.set(room, (this.rooms.get(room) ?? 0) + tokens) }
}
export const estimate = (s: string) => Math.ceil(s.length / 4)
export const fallback = (lines: string[]) => lines.join(' ')
type Complete = (prompt: string) => Promise<string>
export const providerComplete: Complete = async prompt => {
  const base = process.env.OPENROUTER_BASE_URL || 'https://ai.hackclub.com/proxy/v1'
  const r = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` },
    body: JSON.stringify({ model: process.env.OPENROUTER_MODEL || 'anthropic/claude-haiku-5.5', max_tokens: 120,
      messages: [{ role: 'system', content: 'You narrate a fantasy battle in Iceland in 1-2 vivid sentences. Only describe the events given. Invent no mechanics.' }, { role: 'user', content: prompt }] }),
    signal: AbortSignal.timeout(4000),
  })
  if (!r.ok) throw new Error(`AI ${r.status}`)
  return (await r.json()).choices[0].message.content as string
}
export async function narrate(budget: Budget, room: string, lines: string[], complete: Complete = providerComplete) {
  const prompt = lines.join('\n')
  if (!process.env.OPENROUTER_API_KEY && complete === providerComplete) return fallback(lines)
  if (!budget.allow(room)) return fallback(lines)
  try { const out = await complete(prompt); budget.spend(room, estimate(prompt) + estimate(out)); return out }
  catch { return fallback(lines) }
}
