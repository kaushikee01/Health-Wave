// Shared in-browser simulation state. All role screens read/write this one store.
import { createContext, useContext, useEffect, useReducer } from 'react'

// ---- Fixed DEMO data (fictional junction names, demo coordinates near Pune) ----
const A = [[18.5196,73.8553],[18.5228,73.8588],[18.5258,73.8625],[18.5284,73.8672],[18.5312,73.8722],[18.5350,73.8768],[18.5392,73.8810]]
const B = [A[0], A[1], A[2], [18.5240,73.8690], [18.5270,73.8755], [18.5335,73.8790], A[6]]
export const LAST = 6 // index of the last route point (destination)
export const ROUTES = {
  A: { label: 'Route A (primary)', min: 1, pts: A, js: [{ id: 'J1', idx: 2 }, { id: 'J2', idx: 4 }, { id: 'J3', idx: 5 }] },
  B: { label: 'Route B (alternate)', min: 1.4, pts: B, js: [{ id: 'J1', idx: 2 }, { id: 'J4', idx: 4 }, { id: 'J5', idx: 5 }] },
}
export const J = {
  J1: { name: 'Demo Chowk', dir: 'south-west', pos: A[2], note: 'Wide left turn: keep a 12 m turning path clear of parked vehicles.' },
  J2: { name: 'Demo Circle', dir: 'south', pos: A[4], note: 'Roundabout entry: hold cross traffic and clear the inner lane.' },
  J3: { name: 'Demo Flyover Junction', dir: 'west', pos: A[5], note: 'Tight right turn under flyover: keep curb lane and 4.5 m height lane clear.' },
  J4: { name: 'Riverside Junction', dir: 'south', pos: B[4], note: 'Narrow approach: clear the left kerb and stop line area.' },
  J5: { name: 'Market Cross', dir: 'south-west', pos: B[5], note: 'Busy market cross: keep the turning path clear of hawkers and autos.' },
}
export const HOSPITAL = { name: 'Demo City Hospital', pos: A[6] }
export const CENTER = [18.5294, 73.8681]

// ---- Helpers ----
const now = () => new Date().toLocaleTimeString('en-GB')
const log = (s, text) => ({ ...s, events: [{ t: now(), text }, ...s.events] })
export const moving = (s) => s.status === 'active' || s.status === 'rerouted'
export const fmt = (m) => (m <= 0.05 ? 'arriving' : m < 1 ? `${Math.round(m * 60)} s` : `${m.toFixed(1)} min`)
export const destEta = (s) => Math.max(0, (LAST - s.p) * ROUTES[s.route].min)
export const etaTo = (s, id) => {
  const r = ROUTES[s.route].js.find((x) => x.id === id)
  return r ? Math.max(0, (r.idx - s.p) * ROUTES[s.route].min) : null
}
export const nextJ = (s) => ROUTES[s.route].js.find((x) => !s.passed.includes(x.id) && x.idx >= s.p)?.id
export function position(route, p) {
  const pts = ROUTES[route].pts, i = Math.min(Math.floor(p), LAST - 1), f = p - i
  return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f]
}
export function driverMessage(s) {
  const a = ROUTES[s.route].js.find((x) => !s.passed.includes(x.id) && s.alerts.some((al) => al.jid === x.id && (al.status === 'active' || al.status === 'acknowledged')))
  if (!moving(s) || !a) return { speak: false, text: 'No emergency vehicle approaching your corridor.' }
  const who = s.type === 'fire' ? 'Fire truck' : 'Emergency vehicle'
  return { speak: true, jid: a.id, text: `${who} approaching the next junction, ${J[a.id].name}, from the ${J[a.id].dir}. Keep the intersection clear and yield when safe.` }
}

const normalSignals = () => Object.fromEntries(Object.keys(J).map((k) => [k, 'normal']))
const fresh = (speed = 3) => ({
  status: 'idle', type: null, vehicle: null, incident: null, route: 'A', p: 0, paused: false, speed,
  alerts: [], signals: normalSignals(), passed: [], events: [], block: null, focus: null,
  hospital: { status: 'none', data: null },
})

// Checks alerts/signals for upcoming junctions (alert at <= 3 minutes, green at <= 1 minute).
function evaluate(s) {
  let n = { ...s, alerts: [...s.alerts], signals: { ...s.signals }, passed: [...s.passed] }
  const r = ROUTES[n.route]
  for (const { id, idx } of r.js) {
    if (n.passed.includes(id)) continue
    const eta = (idx - n.p) * r.min, name = J[id].name
    if (n.p > idx) {
      n.passed.push(id); n.signals[id] = 'returned'
      n.alerts = n.alerts.map((a) => (a.jid === id && (a.status === 'active' || a.status === 'acknowledged') ? { ...a, status: 'passed' } : a))
      n = log(n, `Vehicle passed ${name}; signal returned to normal (simulated)`)
      continue
    }
    if (eta <= 3 && !n.alerts.some((a) => a.jid === id && a.status !== 'superseded')) { // no duplicates per junction
      n.alerts.push({ id: `${id}-${n.alerts.length}`, jid: id, status: 'active' })
      n.signals[id] = 'requested'
      n = log(n, `Alert issued for ${name} (ETA ${fmt(eta)}); green corridor requested (simulated)`)
    }
    if (eta <= 1 && n.signals[id] === 'requested') { n.signals[id] = 'green'; n = log(n, `Green corridor active at ${name} (simulated)`) }
  }
  return n
}
function finish(s, why) {
  const alerts = s.alerts.map((a) => (a.status === 'active' || a.status === 'acknowledged' ? { ...a, status: 'closed' } : a))
  return log({ ...s, status: 'completed', alerts, signals: normalSignals() }, why)
}
function advance(s, dp) {
  let n = evaluate({ ...s, p: Math.min(LAST, s.p + dp) })
  if (n.p >= LAST) n = finish(n, 'Vehicle arrived at destination. Trip completed; all signals returned to normal (simulated)')
  return n
}

function reducer(s, a) {
  switch (a.type) {
    case 'START': {
      const fire = a.vehicle === 'fire'
      const n = { ...fresh(s.speed), status: 'active', type: a.vehicle, vehicle: fire ? 'FT-07 (demo)' : 'AMB-112 (demo)',
        incident: fire ? 'Structure fire - Demo Warehouse, Sector 9' : null }
      return evaluate(log(n, `${fire ? 'Fire truck' : 'Ambulance'} ${n.vehicle} trip started on Route A (simulated)`))
    }
    case 'TICK': return moving(s) && !s.paused ? advance(s, a.dp) : s
    case 'STEP': return moving(s) ? advance(s, 0.5) : s
    case 'FF': return moving(s) ? advance(s, 1.5) : s
    case 'PAUSE': return moving(s) ? log({ ...s, paused: !s.paused }, s.paused ? 'Movement resumed' : 'Movement paused') : s
    case 'SPEED': return { ...s, speed: a.speed }
    case 'RESET': return fresh(3)
    case 'COMPLETE': return moving(s) ? finish(s, 'Trip completed manually; all signals returned to normal (simulated)') : s
    case 'FOCUS': return { ...s, focus: { id: a.id, n: Date.now() } }
    case 'ACK_ALERT': return log({ ...s, alerts: s.alerts.map((x) => (x.id === a.id ? { ...x, status: 'acknowledged' } : x)) }, `Police acknowledged alert for ${J[a.jid].name} (simulated)`)
    case 'SEND_HOSPITAL':
      if (s.type !== 'ambulance' || !moving(s)) return s
      return log({ ...s, hospital: { status: 'sent', data: a.data } }, `Hospital pre-alert sent to ${a.data.hospital} (demo data, simulated)`)
    case 'ACK_HOSPITAL': return s.hospital.status === 'sent' ? log({ ...s, hospital: { ...s.hospital, status: 'acknowledged' } }, 'Hospital acknowledged pre-alert and is preparing (simulated)') : s
    case 'BLOCK': {
      if (!moving(s) || s.route === 'B') return s
      const keep = new Set(ROUTES.B.js.map((x) => x.id))
      const signals = { ...s.signals }
      Object.keys(signals).forEach((k) => { if (!keep.has(k) && !s.passed.includes(k)) signals[k] = 'normal' })
      const alerts = s.alerts.map((x) => (!keep.has(x.jid) && (x.status === 'active' || x.status === 'acknowledged') ? { ...x, status: 'superseded' } : x))
      let n = log({ ...s, route: 'B', status: 'rerouted', alerts, signals, block: { reason: a.reason } }, `Police reported blockage: "${a.reason}". Rerouted to Route B; ETA and junction alerts refreshed (simulated)`)
      return evaluate(n)
    }
    default: return s
  }
}

const Ctx = createContext(null)
export function SimProvider({ children }) {
  const [s, d] = useReducer(reducer, undefined, () => fresh(3))
  useEffect(() => {
    if (!moving(s) || s.paused) return
    const t = setInterval(() => d({ type: 'TICK', dp: 0.2 * s.speed }), 1000)
    return () => clearInterval(t)
  }, [s.status, s.paused, s.speed])
  useEffect(() => { // simulated hospital reply (no hospital screen in this demo)
    if (s.hospital.status !== 'sent') return
    const t = setTimeout(() => d({ type: 'ACK_HOSPITAL' }), 3000)
    return () => clearTimeout(t)
  }, [s.hospital.status])
  return <Ctx.Provider value={{ s, d }}>{children}</Ctx.Provider>
}
export const useSim = () => useContext(Ctx)
