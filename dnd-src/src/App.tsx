import { useEffect, useState } from 'react'
import EuropeMap from './EuropeMap'
import { COUNTRIES } from '../shared/countries'
import { call } from './api'

type U = { id: string; name: string; team: string; x: number; y: number; hp: number; mine: boolean }
type View = { rev: number; w: number; h: number; over: boolean; log: string[]; vis: string[]; walls: string[]; units: U[]; turnIsYours: boolean }
type Screen = 'home' | 'lobby' | 'overworld' | 'tactical'
const T = 44

export default function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const [name, setName] = useState(''), [join, setJoin] = useState('')
  const [sess, setSess] = useState<{ code: string; pid: string } | null>(null)
  const [view, setView] = useState<View | null>(null)
  const [country, setCountry] = useState<string | null>(null)
  const [err, setErr] = useState('')
  const guard = async (f: () => Promise<void>) => { try { setErr(''); await f() } catch (e) { setErr((e as Error).message) } }

  useEffect(() => {
    if (!sess || screen !== 'tactical') return
    let rev = -1, stop = false
    const tick = async () => {
      try { const v = await call(`/rooms/${sess.code}/state?player=${sess.pid}&since=${rev}`); if (v) { rev = v.rev; setView(v) } } catch {}
      if (!stop) setTimeout(tick, 1500)
    }
    tick(); return () => { stop = true }
  }, [sess, screen])

  const act = (action: unknown) => guard(async () => {
    if (!sess || !view) return
    try { setView(await call(`/rooms/${sess.code}/act`, { playerId: sess.pid, expectedRev: view.rev, action })) }
    catch (e) { if ((e as any).status !== 409) throw e }
  })
  const enter = (r: { code: string; playerId: string }) => { setSess({ code: r.code, pid: r.playerId }); setScreen('lobby') }
  const c = country ? COUNTRIES[country] : null

  return <main>
    {err && <p className="err" role="alert">{err}</p>}
    {screen === 'home' && <>
      <h1>Sagas of Europe</h1>
      <p>A shared campaign across a fogged continent. Iceland is open; the rest wait under the mist.</p>
      <div className="row"><button className="primary" onClick={() => setScreen('lobby')}>Enter the saga</button></div>
    </>}
    {screen === 'lobby' && !sess && <>
      <h2>Gather your party</h2>
      <div className="row"><input placeholder="Your name" value={name} onChange={e => setName(e.target.value)} />
        <button className="primary" disabled={!name} onClick={() => guard(async () => enter(await call('/rooms', { name })))}>Create room</button></div>
      <div className="row"><input placeholder="Room code" value={join} onChange={e => setJoin(e.target.value)} />
        <button disabled={!name || !join} onClick={() => guard(async () => enter(await call(`/rooms/${join}/join`, { name })))}>Join room</button></div>
    </>}
    {screen === 'lobby' && sess && <>
      <h2>Room {sess.code}</h2><p>Share this code. When everyone has joined, head to the map.</p>
      <div className="row"><button className="primary" onClick={() => setScreen('overworld')}>Open the map</button></div>
    </>}
    {screen === 'overworld' && <>
      <h2>Europe</h2>
      <EuropeMap onPick={setCountry} />
      {c && <><h2>{c.mapName}</h2>
        {c.regions.map(r => <p key={r.id}><b>{r.name}</b>: {r.blurb}{r.encounter && <> <button onClick={() => setScreen('tactical')}>Enter the barrow</button></>}</p>)}</>}
    </>}
    {screen === 'tactical' && (view ? <>
      <h2>{view.over ? 'Battle over' : view.turnIsYours ? 'Your turn' : 'Waiting for others'}</h2>
      <Grid v={view} onTile={(x, y) => {
        const foe = view.units.find(u => u.team === 'foe' && u.x === x && u.y === y)
        act(foe ? { t: 'attack', id: foe.id } : { t: 'move', x, y })
      }} />
      <div className="row"><button onClick={() => act({ t: 'end' })} disabled={!view.turnIsYours}>End turn</button>
        <span>Tap a tile within 3 steps to move, or an adjacent foe to attack.</span></div>
      <div className="log" aria-live="polite">{[...view.log].reverse().map((l, i) => <p key={i}>{l}</p>)}</div>
    </> : <p>Loading the barrow…</p>)}
  </main>
}

function Grid({ v, onTile }: { v: View; onTile: (x: number, y: number) => void }) {
  const vis = new Set(v.vis), walls = new Set(v.walls)
  return <svg width={v.w * T} height={v.h * T} viewBox={`0 0 ${v.w * T} ${v.h * T}`}>
    {Array.from({ length: v.w * v.h }, (_, i) => { const x = i % v.w, y = Math.floor(i / v.w), k = `${x},${y}`
      return <rect key={k} x={x * T} y={y * T} width={T - 1} height={T - 1}
        className={!vis.has(k) ? 'fogt' : walls.has(k) ? 'wall' : 'tile'} onClick={() => vis.has(k) && onTile(x, y)} /> })}
    {v.units.map(u => <g key={u.id} pointerEvents="none">
      <circle cx={u.x * T + T / 2} cy={u.y * T + T / 2} r={T / 3} className={u.team === 'foe' ? 'foe' : u.mine ? 'me' : 'ally'} />
      <text x={u.x * T + T / 2} y={u.y * T + T / 2 + 4} textAnchor="middle" fontSize="12" fill="#06141a">{u.hp}</text></g>)}
  </svg>
}
