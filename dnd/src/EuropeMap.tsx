import { geoConicConformal, geoPath, geoCentroid } from 'd3-geo'
import { feature } from 'topojson-client'
import topo from 'world-atlas/countries-110m.json'
import { COUNTRIES } from '../shared/countries'

const all = (feature(topo as any, (topo as any).objects.countries) as any).features as any[]
const europe = all.filter(f => { const [x, y] = geoCentroid(f); return x > -25 && x < 45 && y > 35 && y < 72 })
const W = 760, H = 560
const proj = geoConicConformal().parallels([40, 65]).rotate([-12, 0]).fitExtent([[10, 10], [W - 10, H - 10]],
  { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[-25, 34], [45, 34], [45, 72], [-25, 72], [-25, 34]]] } })
const path = geoPath(proj)
export default function EuropeMap({ onPick }: { onPick: (id: string) => void }) {
  return (
    <svg className="europe" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Map of Europe">
      {europe.map(f => {
        const id = String(f.properties.name).toLowerCase(), c = COUNTRIES[id]
        return <path key={f.id ?? id} d={path(f) ?? ''} className={c?.unlocked ? 'open' : 'land'}
          onClick={c?.unlocked ? () => onPick(id) : undefined}><title>{f.properties.name}{c?.unlocked ? '' : ' (unexplored)'}</title></path>
      })}
    </svg>
  )
}
