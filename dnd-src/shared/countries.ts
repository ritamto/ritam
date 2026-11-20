// Country schema: every country is plain data. Add scotland.ts etc. and register in COUNTRIES.
export type Foe = { id: string; name: string; x: number; y: number; hp: number; atk: number; ac: number }
export type Encounter = { id: string; intro: string; w: number; h: number; walls: string[]; spawn: [number, number][]; foes: Foe[] }
export type Region = { id: string; name: string; blurb: string; adjacent: string[]; sea?: string[]; encounter?: string }
export type Country = { id: string; mapName: string; unlocked: boolean; regions: Region[]; encounters: Record<string, Encounter> }

export const iceland: Country = {
  id: 'iceland', mapName: 'Iceland', unlocked: true,
  regions: [
    { id: 'reykjanes', name: 'Reykjanes', blurb: 'Lava fields and steaming vents.', adjacent: ['capital', 'south'] },
    { id: 'capital', name: 'Capital Region', blurb: 'Harbours, halls and gossip.', adjacent: ['reykjanes', 'west', 'south'] },
    { id: 'west', name: 'Westfjords', blurb: 'Sheer cliffs and lonely farms.', adjacent: ['capital', 'north'] },
    { id: 'north', name: 'Northland', blurb: 'Whale coasts and Lake Mývatn.', adjacent: ['west', 'east', 'highlands'] },
    { id: 'east', name: 'Eastfjords', blurb: 'Fog, fishing towns, and old trolls.', adjacent: ['north', 'south'] },
    { id: 'south', name: 'South Coast', blurb: 'Black sand and glacier tongues.', adjacent: ['reykjanes', 'capital', 'east', 'highlands'], encounter: 'draugr_barrow' },
    { id: 'highlands', name: 'Highlands', blurb: 'Ash deserts. No roads, no mercy.', adjacent: ['north', 'south'] },
  ],
  encounters: {
    draugr_barrow: {
      id: 'draugr_barrow', intro: 'Frost bites at the barrow mouth. Something stirs beneath the stones.',
      w: 12, h: 8,
      walls: ['5,0','5,1','5,2','5,5','5,6','5,7','8,3','8,4','2,3','3,3'],
      spawn: [[1, 3], [1, 4], [0, 2], [0, 5]],
      foes: [
        { id: 'f1', name: 'Frost Draugr', x: 9, y: 2, hp: 9, atk: 3, ac: 11 },
        { id: 'f2', name: 'Barrow Warden', x: 10, y: 5, hp: 12, atk: 4, ac: 12 },
        { id: 'f3', name: 'Cairn Wight', x: 7, y: 6, hp: 7, atk: 2, ac: 10 },
      ],
    },
  },
}
export const COUNTRIES: Record<string, Country> = { iceland }
