import { describe, it, expect } from 'vitest'
import { iceland } from '../shared/countries'
import { act, addPlayer, newGame, project, type State } from '../shared/engine'
import { Budget, narrate } from '../server/narrator'

const enc = iceland.encounters.draugr_barrow
const setup = (seed: number) => { const s = newGame(seed, enc); addPlayer(s, 'A', 'Ayla', enc); addPlayer(s, 'B', 'Bjorn', enc); return s }
const play = (seed: number) => { let s: State = setup(seed)
  for (let i = 0; i < 12 && !s.over; i++) { const u = s.units[s.turn]
    s = act(s, u.owner!, { t: 'move', x: Math.min(u.x + 1, 4), y: u.y }) }
  return s }

describe('combat', () => {
  it('is deterministic for a seed', () => expect(play(42)).toEqual(play(42)))
  it('rejects out-of-turn actions', () => expect(() => act(setup(1), 'B', { t: 'end' })).toThrow('not your turn'))
})
describe('fog of war', () => {
  it('never serializes hidden foes, seed, or player ids', () => {
    const out = JSON.stringify(project(setup(7), 'A'))
    for (const f of enc.foes) expect(out).not.toContain(f.name)
    expect(out).not.toContain('"seed"'); expect(out).not.toContain('"owner"'); expect(out).not.toContain('"B"')
  })
})
describe('AI budget', () => {
  it('stops calling the provider at the cap and falls back', async () => {
    let calls = 0; const complete = async () => { calls++; return 'x'.repeat(400) }
    const b = new Budget(150, 150), outs = []
    for (let i = 0; i < 5; i++) outs.push(await narrate(b, 'R', ['The draugr rises.'], complete))
    expect(calls).toBeLessThan(5); expect(outs.at(-1)).toBe('The draugr rises.')
  })
  it('never calls the provider when disabled', async () => {
    let calls = 0; await narrate(new Budget(0, 0), 'R', ['a'], async () => { calls++; return 'x' }); expect(calls).toBe(0)
  })
})
