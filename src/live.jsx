// Live mode: same {s, d} interface as sim.jsx, but data comes from the Health-Wave backend (REST + Socket.IO).
import { useCallback, useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import { Ctx, ROUTES, J, HOSPITAL, LAST, moving } from './sim.jsx'

const API = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
const ORIGIN = { lat: 18.5196, lng: 73.8553 }, DEST = { lat: 18.5392, lng: 73.881, name: 'Demo Hospital' } // fixed demo coordinates
const IDLE = { status: 'idle', type: null, vehicle: null, incident: null, route: 'A', p: 0, paused: false, speed: 3, alerts: [], passed: [], events: [],
  block: null, focus: null, hospital: { status: 'none', data: null }, mode: 'live', conn: 'connecting', error: null, tripId: null }
const normal = () => Object.fromEntries(Object.keys(J).map((k) => [k, 'normal']))

export function LiveProvider({ children }) {
  const [s, setS] = useState({ ...IDLE, signals: normal() })
  const tok = useRef(null), geo = useRef({}), mine = useRef(false), sRef = useRef(s)
  sRef.current = s

  const call = useCallback(async (path, method = 'GET', body) => {
    const r = await fetch(API + path, { method, headers: { 'Content-Type': 'application/json', ...(tok.current ? { Authorization: 'Bearer ' + tok.current } : {}) }, body: body && JSON.stringify(body) })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(j.error || 'Request failed (' + r.status + ')')
    return j
  }, [])

  // Pull the latest trip from the backend and translate it into the shape the screens already use.
  const refresh = useCallback(async () => {
    const list = await call('/api/trips'), t = list[list.length - 1]
    if (!t) {
      ROUTES.A.js = []; ROUTES.B.js = []
      setS((p) => ({ ...IDLE, speed: p.speed, focus: p.focus, signals: normal(), conn: 'connected' }))
      return
    }
    if (!geo.current[t.id]) geo.current[t.id] = (await call('/api/trips/' + t.id)).routeGeometry
    const [alerts, events] = await Promise.all([call('/api/alerts'), call('/api/events?tripId=' + t.id)])
    const g = geo.current[t.id], min = Math.max(t.durationSec, 1) / 60 / LAST, p = t.progress * LAST
    Object.keys(J).forEach((k) => delete J[k])
    ;['A', 'B'].forEach((k) => { ROUTES[k].pts = (g[k] || []).map((q) => [q.lat, q.lng]); ROUTES[k].min = min; ROUTES[k].js = [] })
    ROUTES[t.route].js = t.junctions.map((j) => ({ id: j.id, idx: p + j.etaSec / 60 / min }))
    t.junctions.forEach((j) => { J[j.id] = { name: j.name, dir: j.from, pos: [j.lat, j.lng], note: 'Keep the junction and its turning path clear.' } })
    const end = ROUTES[t.route].pts[ROUTES[t.route].pts.length - 1]
    if (end) { HOSPITAL.pos = end; HOSPITAL.name = t.destination?.name || 'Destination' }
    setS((prev) => ({ ...prev, status: t.status, type: t.type, vehicle: t.vehicleNo, tripId: t.id, route: t.route, p, block: t.blockage, conn: 'connected', error: null,
      incident: t.type === 'fire' ? 'Demo fire incident (live backend)' : null,
      alerts: alerts.filter((a) => a.tripId === t.id).map((a) => ({ id: a.id, jid: a.jid, status: a.status })),
      signals: Object.fromEntries(t.junctions.map((j) => [j.id, j.signal])), passed: t.junctions.filter((j) => j.passed).map((j) => j.id),
      events: events.map((e) => ({ t: new Date(e.at).toLocaleTimeString('en-GB'), text: e.text })) }))
  }, [call])

  const d = useCallback(async (a) => {
    const id = sRef.current.tripId
    try {
      switch (a.type) {
        case 'START': mine.current = true; geo.current = {}; await call('/api/trips', 'POST', { type: a.vehicle, vehicleNo: a.vehicle === 'fire' ? 'FT-07' : 'AMB-112', origin: ORIGIN, destination: DEST }); break
        case 'STEP': await call(`/api/trips/${id}/simulate-step`, 'POST'); break
        case 'FF': await call(`/api/trips/${id}/simulate-step`, 'POST'); await call(`/api/trips/${id}/simulate-step`, 'POST').catch(() => {}); break
        case 'COMPLETE': await call(`/api/trips/${id}/complete`, 'POST'); break
        case 'BLOCK': await call(`/api/trips/${id}/blockage`, 'POST', { reason: a.reason }); break
        case 'ACK_ALERT': await call(`/api/alerts/${a.id}/ack`, 'POST'); break
        case 'RESET': mine.current = false; geo.current = {}; await call('/api/admin/reset', 'POST'); break
        case 'PAUSE': setS((p) => ({ ...p, paused: !p.paused })); return
        case 'SPEED': setS((p) => ({ ...p, speed: a.speed })); return
        case 'FOCUS': setS((p) => ({ ...p, focus: { id: a.id, n: Date.now() } })); return
        case 'SEND_HOSPITAL': // not part of the backend yet: simulated locally
          setS((p) => ({ ...p, hospital: { status: 'sent', data: a.data } }))
          setTimeout(() => setS((p) => ({ ...p, hospital: { ...p.hospital, status: 'acknowledged' } })), 3000); return
        default: return
      }
      await refresh()
    } catch (e) { setS((p) => ({ ...p, error: e.message })) }
  }, [call, refresh])

  // Demo movement: only the browser that started the trip advances it (real GPS would call /location instead).
  useEffect(() => {
    if (!mine.current || !moving(s) || s.paused) return
    const t = setInterval(() => call(`/api/trips/${s.tripId}/simulate-step`, 'POST').then(refresh).catch(() => {}), 3000 / s.speed)
    return () => clearInterval(t)
  }, [s.status, s.paused, s.speed, s.tripId])

  useEffect(() => {
    let sock
    ;(async () => {
      try {
        const r = await call('/api/auth/login', 'POST', { username: 'admin1', password: import.meta.env.VITE_DEMO_PASSWORD || 'demo123' }) // demo-only shortcut
        tok.current = r.token
        sock = io(API, { auth: { token: r.token } })
        ;['trip:update', 'alerts:update', 'reset'].forEach((e) => sock.on(e, () => refresh().catch(() => {})))
        await refresh()
      } catch (e) { setS((p) => ({ ...p, conn: 'offline', error: 'Cannot reach backend at ' + API + ' (' + e.message + ')' })) }
    })()
    return () => sock && sock.disconnect()
  }, [])

  return <Ctx.Provider value={{ s, d }}>{children}</Ctx.Provider>
}
