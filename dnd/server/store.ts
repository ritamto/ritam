import { neon } from '@neondatabase/serverless'
import type { State } from '../shared/engine'
export type Room = { code: string; players: Record<string, string>; country: string; encounter: string; state: State }
const sql = process.env.DND_DATABASE_URL ? neon(process.env.DND_DATABASE_URL) : null
const mem = new Map<string, Room>()
export async function init() { if (sql) await sql`create table if not exists rooms (id text primary key, data jsonb not null)` }
export async function getRoom(id: string): Promise<Room | undefined> {
  if (!sql) return mem.get(id)
  const r = await sql`select data from rooms where id=${id}`; return r[0]?.data as Room | undefined
}
export async function createRoom(room: Room) {
  if (!sql) { mem.set(room.code, room); return }
  await sql`insert into rooms(id,data) values(${room.code},${JSON.stringify(room)}::jsonb)`
}
// Atomic compare-and-set on revision. Returns false if someone else wrote first.
export async function saveRoom(room: Room, expectedRev: number): Promise<boolean> {
  if (!sql) { if (mem.get(room.code)?.state.rev !== expectedRev) return false; mem.set(room.code, room); return true }
  const r = await sql`update rooms set data=${JSON.stringify(room)}::jsonb where id=${room.code} and (data->'state'->>'rev')::int=${expectedRev} returning id`
  return r.length > 0
}
