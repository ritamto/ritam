import { Hono } from 'hono'
import { COUNTRIES } from '../shared/countries'
import { act, addPlayer, newGame, project, type Action } from '../shared/engine'
import { Budget, narrate } from './narrator'
import { createRoom, getRoom, saveRoom } from './store'

const budget = new Budget(Number(process.env.AI_BUDGET_TOKENS_GLOBAL ?? 200000), Number(process.env.AI_BUDGET_TOKENS_PER_ROOM ?? 20000))
export const app = new Hono()
const hex = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => b.toString(16).padStart(2, '0')).join('')
const api = new Hono()
const enc = (r: { country: string; encounter: string }) => COUNTRIES[r.country].encounters[r.encounter]

api.post('/rooms', async c => {
  const { name } = await c.req.json()
  const code = hex(3).toUpperCase(), pid = hex(16)
  const room = { code, players: { [pid]: String(name).slice(0, 20) }, country: 'iceland', encounter: 'draugr_barrow',
    state: newGame(crypto.getRandomValues(new Uint32Array(1))[0], COUNTRIES.iceland.encounters.draugr_barrow) }
  addPlayer(room.state, pid, room.players[pid], enc(room))
  await createRoom(room)
  return c.json({ code, playerId: pid })
})
api.post('/rooms/:code/join', async c => {
  const room = await getRoom(c.req.param('code').toUpperCase()); if (!room) return c.json({ error: 'no such room' }, 404)
  const { name } = await c.req.json(), pid = hex(16)
  try { addPlayer(room.state, pid, String(name).slice(0, 20), enc(room)) } catch (e) { return c.json({ error: (e as Error).message }, 400) }
  room.players[pid] = String(name).slice(0, 20)
  if (!(await saveRoom(room, 0))) return c.json({ error: 'conflict, retry' }, 409)
  return c.json({ code: room.code, playerId: pid })
})
api.get('/rooms/:code/state', async c => {
  const room = await getRoom(c.req.param('code').toUpperCase()), pid = c.req.query('player') ?? ''
  if (!room || !room.players[pid]) return c.json({ error: 'forbidden' }, 403)
  if (Number(c.req.query('since')) === room.state.rev) return c.body(null, 304)
  return c.json(project(room.state, pid))
})
api.post('/rooms/:code/act', async c => {
  const room = await getRoom(c.req.param('code').toUpperCase())
  const { playerId, expectedRev, action } = await c.req.json() as { playerId: string; expectedRev: number; action: Action }
  if (!room || !room.players[playerId]) return c.json({ error: 'forbidden' }, 403)
  if (expectedRev !== room.state.rev) return c.json({ error: 'stale revision', rev: room.state.rev }, 409)
  try {
    const next = act(room.state, playerId, action)
    const fresh = next.log.slice(room.state.log.length)
    // fresh log lines are public-safe (hidden foe movement is never logged)
    if (fresh.length) next.log.push('📖 ' + await narrate(budget, room.code, fresh))
    room.state = next
  } catch (e) { return c.json({ error: (e as Error).message }, 400) }
  if (!(await saveRoom(room, expectedRev))) return c.json({ error: 'stale revision' }, 409)
  return c.json(project(room.state, playerId))
})

app.route('/dnd/api', api)
app.route('/api/dnd', api)
app.get('/dnd-co', c => c.redirect('/dnd/'))
