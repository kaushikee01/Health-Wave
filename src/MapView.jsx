import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import { useSim, ROUTES, J, HOSPITAL, CENTER, position, moving } from './sim.jsx'

const icon = (cls) => L.divIcon({ className: '', html: `<div class="mk ${cls}"></div>`, iconSize: [18, 18], iconAnchor: [9, 9] })
const SIG = { normal: 'gray', requested: 'amber', green: 'teal', returned: 'gray' }

export default function MapView({ tall }) {
  const { s } = useSim()
  const el = useRef(), map = useRef(), layer = useRef()
  const [fail, setFail] = useState(false)

  useEffect(() => {
    const m = L.map(el.current).setView(CENTER, 14)
    const t = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(m)
    let errs = 0
    t.on('tileerror', () => { if (++errs > 3) setFail(true) })
    t.on('tileload', () => setFail(false))
    m.fitBounds(L.latLngBounds([...ROUTES.A.pts, ...ROUTES.B.pts]), { padding: [30, 30] })
    layer.current = L.layerGroup().addTo(m); map.current = m
    setTimeout(() => m.invalidateSize(), 100)
    return () => m.remove()
  }, [])

  useEffect(() => {
    const g = layer.current; g.clearLayers()
    const sel = s.route
    ;['A', 'B'].forEach((k) => L.polyline(ROUTES[k].pts, { color: k === sel ? '#0f9d8a' : '#7b8794', weight: k === sel ? 5 : 3, dashArray: k === sel ? null : '6 8' }).addTo(g))
    ROUTES[sel].js.forEach(({ id }) => L.marker(J[id].pos, { icon: icon(s.passed.includes(id) ? 'gray' : SIG[s.signals[id]]) }).bindTooltip(`${J[id].name} (${s.signals[id]})`).addTo(g))
    L.marker(HOSPITAL.pos, { icon: icon(s.type === 'fire' ? 'dest' : 'hosp') }).bindTooltip(s.type === 'fire' ? 'Incident location (demo)' : HOSPITAL.name).addTo(g)
    if (s.status !== 'idle') L.marker(position(s.route, s.p), { icon: icon('veh') }).bindTooltip(s.vehicle).addTo(g)
    else L.marker(ROUTES.A.pts[0], { icon: icon('veh') }).bindTooltip('Demo start point').addTo(g)
  }, [s])

  useEffect(() => { if (s.focus && J[s.focus.id]) map.current.flyTo(J[s.focus.id].pos, 16) }, [s.focus])
  useEffect(() => { if (s.tripId && ROUTES.A.pts.length > 1) map.current.fitBounds(L.latLngBounds(ROUTES.A.pts), { padding: [30, 30] }) }, [s.tripId])

  // Fallback drawing if map tiles cannot load (offline demo)
  const all = [...ROUTES.A.pts, ...ROUTES.B.pts]
  const la = all.map((p) => p[0]), lo = all.map((p) => p[1])
  const [minA, maxA, minO, maxO] = [Math.min(...la), Math.max(...la), Math.min(...lo), Math.max(...lo)]
  const pr = (p) => [30 + ((p[1] - minO) / (maxO - minO)) * 540, 270 - ((p[0] - minA) / (maxA - minA)) * 240]
  const line = (pts) => pts.map((p) => pr(p).join(',')).join(' ')
  const v = pr(position(s.route, s.p))
  return (
    <div className={'mapwrap' + (tall ? ' tall' : '')}>
      <div ref={el} className="map" />
      {fail && (
        <svg className="fallback" viewBox="0 0 600 300" role="img" aria-label="Fallback route visualization">
          <rect width="600" height="300" fill="#10203a" />
          <text x="12" y="20" fill="#9fb3c8" fontSize="11">Map tiles unavailable - fallback route view (demo coordinates)</text>
          <polyline points={line(ROUTES.A.pts)} fill="none" stroke={s.route === 'A' ? '#0f9d8a' : '#7b8794'} strokeWidth="4" strokeDasharray={s.route === 'A' ? '' : '6 6'} />
          <polyline points={line(ROUTES.B.pts)} fill="none" stroke={s.route === 'B' ? '#0f9d8a' : '#7b8794'} strokeWidth="4" strokeDasharray={s.route === 'B' ? '' : '6 6'} />
          {ROUTES[s.route].js.map(({ id }) => <g key={id}><circle cx={pr(J[id].pos)[0]} cy={pr(J[id].pos)[1]} r="8" fill={s.signals[id] === 'green' ? '#0f9d8a' : s.signals[id] === 'requested' ? '#d98e04' : '#9fb3c8'} /><text x={pr(J[id].pos)[0] + 12} y={pr(J[id].pos)[1] + 4} fill="#e8eef5" fontSize="11">{J[id].name}</text></g>)}
          <rect x={pr(HOSPITAL.pos)[0] - 7} y={pr(HOSPITAL.pos)[1] - 7} width="14" height="14" fill="#e8eef5" />
          <circle cx={v[0]} cy={v[1]} r="8" fill="#c0392b" stroke="#fff" strokeWidth="2" />
        </svg>
      )}
      <div className="maplegend">Simulated positions on demo coordinates{moving(s) ? '' : ' - no active trip'}</div>
    </div>
  )
}
