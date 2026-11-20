import { neon } from '@neondatabase/serverless'
import type { State } from '../shared/engine'
export type Room = { code: string; players: Record<string, string>; country: string; encounter: string; state: State }
const sql = process.env.DND_DATABASE_URL ? neon(process.env.DND_DATABASE_URL) : null
const mem = new Map<string, Room>()
let ready: Promise<unknown> | null = null
const ensure = () => (ready ??= sql ? sql`create table if not exists dnd_rooms (id text primary key, data jsonb not null)` : Promise.resolve())
export async function getRoom(id: string): Promise<Room | undefined> {
  await ensure()
  if (!sql) return mem.get(id)
  const r = await sql`select data from dnd_rooms where id=${id}`; return r[0]?.data as Room | undefined
}
export async function createRoom(room: Room) {
  await ensure()
  if (!sql) { mem.set(room.code, room); return }
  await sql`insert into dnd_rooms(id,data) values(${room.code},${JSON.stringify(room)}::jsonb)`
}
// Atomic compare-and-set on revision. Returns false if someone else wrote first.
export async function saveRoom(room: Room, expectedRev: number): Promise<boolean> {
  await ensure()
  if (!sql) { if (mem.get(room.code)?.state.rev !== expectedRev) return false; mem.set(room.code, room); return true }
  const r = await sql`update dnd_rooms set data=${JSON.stringify(room)}::jsonb where id=${room.code} and (data->'state'->>'rev')::int=${expectedRev} returning id`
  return r.length > 0
}
