// Pure, seeded, I/O-free game engine. The only way state leaves the server is project().
import type { Encounter } from './countries'
export type Unit = { id: string; owner: string | null; name: string; team: 'party' | 'foe'; x: number; y: number; hp: number; atk: number; ac: number }
export type State = { rev: number; seed: number; rolls: number; w: number; h: number; walls: string[]; units: Unit[]; turn: number; log: string[]; over: boolean }
export type Action = { t: 'move'; x: number; y: number } | { t: 'attack'; id: string } | { t: 'end' }

const key = (x: number, y: number) => `${x},${y}`
function mulberry(seed: number) { let t = (seed + 0x6d2b79f5) >>> 0; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
export function roll(s: State, sides: number) { const v = Math.floor(mulberry(s.seed + s.rolls * 7919) * sides) + 1; s.rolls++; return v }

export function newGame(seed: number, enc: Encounter): State {
  return { rev: 0, seed, rolls: 0, w: enc.w, h: enc.h, walls: [...enc.walls], turn: 0, over: false, log: [enc.intro],
    units: enc.foes.map(f => ({ ...f, owner: null, team: 'foe' as const })) }
}
export function addPlayer(s: State, pid: string, name: string, enc: Encounter) {
  if (s.rev !== 0) throw new Error('game already started')
  const n = s.units.filter(u => u.team === 'party').length
  if (n >= enc.spawn.length) throw new Error('room full')
  const [x, y] = enc.spawn[n]
  s.units.splice(n, 0, { id: `u${n}`, owner: pid, name, team: 'party', x, y, hp: 14, atk: 4, ac: 12 })
}
const alive = (u: Unit) => u.hp > 0
const cheb = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))
const free = (s: State, x: number, y: number) => x >= 0 && y >= 0 && x < s.w && y < s.h && !s.walls.includes(key(x, y)) && !s.units.some(u => alive(u) && u.x === x && u.y === y)

function los(s: State, a: { x: number; y: number }, b: { x: number; y: number }) {
  let { x, y } = a; const dx = Math.abs(b.x - x), dy = Math.abs(b.y - y), sx = x < b.x ? 1 : -1, sy = y < b.y ? 1 : -1; let e = dx - dy
  while (x !== b.x || y !== b.y) {
    if ((x !== a.x || y !== a.y) && s.walls.includes(key(x, y))) return false
    const e2 = 2 * e; if (e2 > -dy) { e -= dy; x += sx } if (e2 < dx) { e += dx; y += sy }
  }
  return true
}
export function visible(s: State) {
  const v = new Set<string>()
  for (const u of s.units.filter(u => u.team === 'party' && alive(u)))
    for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++)
      if (Math.hypot(x - u.x, y - u.y) <= 4.5 && los(s, u, { x, y })) v.add(key(x, y))
  return v
}
function strike(s: State, a: Unit, d: Unit) {
  const r = roll(s, 20) + a.atk
  if (r >= d.ac) { const dmg = roll(s, 6); d.hp -= dmg; s.log.push(`${a.name} hits ${d.name} for ${dmg}.${d.hp <= 0 ? ` ${d.name} falls.` : ''}`) }
  else s.log.push(`${a.name} misses ${d.name}.`)
}
function checkEnd(s: State) {
  if (!s.units.some(u => u.team === 'foe' && alive(u))) { s.over = true; s.log.push('Victory. The barrow falls silent.') }
  else if (!s.units.some(u => u.team === 'party' && alive(u))) { s.over = true; s.log.push('The party is lost to the cold.') }
}
function advance(s: State) {
  for (let i = 0; i < s.units.length * 2 && !s.over; i++) {
    s.turn = (s.turn + 1) % s.units.length
    const u = s.units[s.turn]
    if (!alive(u)) continue
    if (u.team === 'party') return
    const t = s.units.filter(t => t.team === 'party' && alive(t)).sort((a, b) => cheb(u, a) - cheb(u, b))[0]
    if (!t) return
    for (let step = 0; step < 2 && cheb(u, t) > 1; step++) {
      const sx = Math.sign(t.x - u.x), sy = Math.sign(t.y - u.y)
      for (const [dx, dy] of [[sx, sy], [sx, 0], [0, sy]]) if ((dx || dy) && free(s, u.x + dx, u.y + dy)) { u.x += dx; u.y += dy; break }
    }
    if (cheb(u, t) <= 1) { strike(s, u, t); checkEnd(s) }
  }
}
export function act(s0: State, pid: string, a: Action): State {
  const s = structuredClone(s0)
  if (s.over) throw new Error('game over')
  const u = s.units[s.turn]
  if (u.owner !== pid) throw new Error('not your turn')
  if (a.t === 'move') {
    if (!Number.isInteger(a.x) || !Number.isInteger(a.y) || cheb(u, a) > 3 || !free(s, a.x, a.y)) throw new Error('illegal move')
    u.x = a.x; u.y = a.y
  } else if (a.t === 'attack') {
    const d = s.units.find(x => x.id === a.id && x.team === 'foe' && alive(x))
    if (!d || cheb(u, d) > 1) throw new Error('illegal attack')
    strike(s, u, d); checkEnd(s)
  } else if (a.t !== 'end') throw new Error('unknown action')
  if (!s.over) advance(s)
  s.rev++
  return s
}
export function project(s: State, pid: string) {
  const vis = visible(s)
  return {
    rev: s.rev, w: s.w, h: s.h, over: s.over, log: s.log,
    vis: [...vis], walls: s.walls.filter(w => vis.has(w)),
    turnIsYours: s.units[s.turn]?.owner === pid,
    units: s.units.filter(u => u.team === 'party' || vis.has(key(u.x, u.y)))
      .map(({ owner, atk, ac, ...u }) => ({ ...u, mine: owner === pid })),
  }
}
