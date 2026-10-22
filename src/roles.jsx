import { useEffect, useState } from 'react'
import { Volume2, VolumeX, MapPin, CheckCircle2, ShieldAlert } from 'lucide-react'
import MapView from './MapView.jsx'
import { useSim, ROUTES, J, HOSPITAL, etaTo, destEta, nextJ, fmt, moving, driverMessage } from './sim.jsx'

// ---------- shared small pieces ----------
const Card = ({ title, children, className = '' }) => <section className={'card ' + className}>{title && <h3>{title}</h3>}{children}</section>
const Pill = ({ tone = 'gray', children }) => <span className={'pill ' + tone}>{children}</span>
const Empty = ({ children }) => <p className="empty">{children}</p>
const STATUS_TONE = { idle: 'gray', active: 'teal', rerouted: 'amber', completed: 'gray' }
const SIG_LABEL = { normal: 'Normal', requested: 'Corridor requested', green: 'Green corridor active', returned: 'Returned to normal' }
const SIG_TONE = { normal: 'gray', requested: 'amber', green: 'teal', returned: 'gray' }
const ALERT_TONE = { active: 'red', acknowledged: 'teal', passed: 'gray', superseded: 'amber', closed: 'gray' }

export function Timeline() {
  const { s } = useSim()
  return (
    <Card title="Event timeline">
      {s.events.length === 0 ? <Empty>No events yet. Start a trip to begin.</Empty> :
        <ul className="timeline">{s.events.map((e, i) => <li key={i}><time>{e.t}</time>{e.text}</li>)}</ul>}
    </Card>
  )
}

export function Controls({ role, presenter }) {
  const { s, d } = useSim()
  const types = presenter ? [] : role === 'ambulance' ? ['ambulance'] : role === 'fire' ? ['fire'] : ['ambulance', 'fire']
  const live = moving(s)
  return (
    <div className="bar">
      {!live && types.map((t) => <button key={t} className="btn primary" onClick={() => d({ type: 'START', vehicle: t })}>Start {t === 'fire' ? 'fire truck' : 'ambulance'} trip</button>)}
      {live && <>
        <button className="btn" onClick={() => d({ type: 'PAUSE' })}>{s.paused ? 'Resume' : 'Pause'}</button>
        <button className="btn" onClick={() => d({ type: 'STEP' })}>Advance one step</button>
        <button className="btn" onClick={() => d({ type: 'FF' })}>Fast-forward</button>
        <button className="btn" onClick={() => d({ type: 'COMPLETE' })}>Complete trip</button>
      </>}
      <button className="btn ghost" onClick={() => d({ type: 'RESET' })}>Reset demo</button>
      <span className="seg" title="Demo speed">Speed {[1, 3, 8].map((x) => <button key={x} className={s.speed === x ? 'on' : ''} onClick={() => d({ type: 'SPEED', speed: x })}>{x}x</button>)}</span>
    </div>
  )
}

function TripStatus() {
  const { s } = useSim()
  const nj = nextJ(s), live = moving(s)
  return (
    <section className="hero">
      <div className="hero-top">
        <div><small>VEHICLE</small><b>{s.vehicle || 'No active trip'}</b></div>
        <Pill tone={STATUS_TONE[s.status]}>{s.status}{s.paused ? ' / paused' : ''}</Pill>
      </div>
      <div className="nums">
        <div><small>NEXT JUNCTION</small><span className="big">{live && nj ? fmt(etaTo(s, nj)) : '--'}</span><em>{live && nj ? J[nj].name : 'Waiting for trip'}</em></div>
        <div><small>DESTINATION ETA</small><span className="big">{s.status === 'idle' ? '--' : fmt(destEta(s))}</span><em>{ROUTES[s.route].label}</em></div>
      </div>
      <div className="track"><i style={{ width: Math.round((s.p / 6) * 100) + '%' }} />{ROUTES[s.route].js.map((j) => <u key={j.id} style={{ left: (j.idx / 6) * 100 + '%' }} />)}</div>
    </section>
  )
}

function BlockageCard() {
  const { s } = useSim()
  return (
    <Card title="Blockage and reroute">
      {s.block ? <p><Pill tone="amber">Rerouted</Pill> Blockage reported: "{s.block.reason}". Now following {ROUTES.B.label}; ETA {fmt(destEta(s))}. Junction alerts refreshed.</p>
        : <p className="muted">No blockage reported. Route B is saved as the alternate. Traffic Police can report a blockage to trigger a reroute.</p>}
    </Card>
  )
}

// ---------- Ambulance ----------
export function AmbulanceView() {
  const { s, d } = useSim()
  const [f, setF] = useState({ caseType: '', age: '', notes: '', hospital: HOSPITAL.name })
  const [err, setErr] = useState({})
  const amb = s.type === 'ambulance' && moving(s)
  const send = () => {
    const e = {}
    if (!f.caseType) e.caseType = 'Choose a demo case type.'
    const a = Number(f.age)
    if (f.age === '' || !Number.isInteger(a) || a < 0 || a > 120) e.age = 'Enter a whole age between 0 and 120.'
    if (f.notes.length > 120) e.notes = 'Keep notes under 120 characters.'
    setErr(e)
    if (Object.keys(e).length === 0) d({ type: 'SEND_HOSPITAL', data: { ...f, age: a } })
  }
  const h = s.hospital
  return (
    <div className="grid">
      <div className="col wide"><MapView tall /><Timeline /></div>
      <div className="col">
        <TripStatus />
        <Card title="Hospital pre-alert (DEMO DATA ONLY)">
          {s.type === 'fire' && moving(s) ? <Empty>A fire truck trip is active. Pre-alerts apply to ambulance trips only.</Empty> :
            !amb && h.status === 'none' ? <Empty>Start an ambulance trip to send a pre-alert.</Empty> : (
              <div className="form">
                <p className="note">Do not enter real patient information. Fake values only. The hospital reply is auto-simulated a few seconds after sending.</p>
                <label>Case type<select value={f.caseType} onChange={(e) => setF({ ...f, caseType: e.target.value })} disabled={h.status !== 'none'}>
                  <option value="">Select...</option><option>Cardiac (demo)</option><option>Road accident (demo)</option><option>Stroke (demo)</option><option>Breathing difficulty (demo)</option></select></label>
                {err.caseType && <small className="err">{err.caseType}</small>}
                <label>Age (demo)<input type="number" value={f.age} onChange={(e) => setF({ ...f, age: e.target.value })} disabled={h.status !== 'none'} /></label>
                {err.age && <small className="err">{err.age}</small>}
                <label>Short non-sensitive notes<input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} disabled={h.status !== 'none'} placeholder="e.g. conscious, oxygen on" /></label>
                {err.notes && <small className="err">{err.notes}</small>}
                <label>Destination hospital<select value={f.hospital} onChange={(e) => setF({ ...f, hospital: e.target.value })} disabled={h.status !== 'none'}>
                  <option>{HOSPITAL.name}</option><option>Demo Riverside Medical Centre</option></select></label>
                <button className="btn primary" onClick={send} disabled={!amb || h.status !== 'none'}>Send hospital pre-alert (simulated)</button>
                <div>Hospital status: <Pill tone={h.status === 'acknowledged' ? 'teal' : h.status === 'sent' ? 'amber' : 'gray'}>{h.status === 'none' ? 'Not sent' : h.status === 'sent' ? 'Sent - awaiting acknowledgment' : 'Acknowledged - preparing'}</Pill></div>
              </div>)}
        </Card>
        <BlockageCard />
      </div>
    </div>
  )
}

// ---------- Fire truck ----------
export function FireView() {
  const { s } = useSim()
  const list = ROUTES[s.route].js
  return (
    <div className="grid">
      <div className="col wide"><MapView tall /><Timeline /></div>
      <div className="col">
        <TripStatus />
        <Card title="Incident and vehicle">
          {s.type === 'fire' ? <>
            <p><b>{s.incident}</b> (demo)</p>
            <p className="muted">Large vehicle (demo): 12 m ladder truck, 2.5 m wide, 3.9 m high. No hospital pre-alert applies to fire trips.</p></>
            : <Empty>{s.type === 'ambulance' && moving(s) ? 'An ambulance trip is active. Start a fire truck trip after resetting.' : 'No active fire truck trip. Start one above.'}</Empty>}
        </Card>
        <Card title="Junctions, turns and clearance notes">
          {s.status === 'idle' ? <Empty>Junction clearance notes appear once a trip starts.</Empty> : list.map(({ id }) => {
            const al = s.alerts.find((a) => a.jid === id && a.status !== 'superseded')
            return <div className="row" key={id}><div><b>{J[id].name}</b> <small className="muted">from the {J[id].dir}</small><p className="muted">{J[id].note}</p></div>
              <div className="right">{s.passed.includes(id) ? <Pill>Passed</Pill> : <><b>{fmt(etaTo(s, id))}</b><br />{al ? <Pill tone={ALERT_TONE[al.status]}>Police alert: {al.status}</Pill> : <Pill>No alert yet</Pill>}</>}</div></div>
          })}
        </Card>
        <BlockageCard />
      </div>
    </div>
  )
}

// ---------- Traffic police ----------
export function PoliceView() {
  const { s, d } = useSim()
  const [reason, setReason] = useState(''), [err, setErr] = useState('')
  const live = s.alerts.filter((a) => a.status === 'active' || a.status === 'acknowledged')
  const old = s.alerts.filter((a) => a.status === 'superseded')
  const report = () => {
    if (reason.trim().length < 3) return setErr('Enter a short reason (at least 3 characters).')
    if (!moving(s)) return setErr('Start a trip first.')
    if (s.route === 'B') return setErr('Already rerouted to Route B.')
    setErr(''); d({ type: 'BLOCK', reason: reason.trim() }); setReason('')
  }
  return (
    <div className="grid flip">
      <div className="col">
        <Card title="Upcoming junction alerts">
          <p className="note">Simulated console. A real deployment concept may use SMS/WhatsApp; this prototype sends nothing.</p>
          {live.length === 0 ? <Empty>{moving(s) ? 'No junction within 3 minutes yet. Use Fast-forward.' : 'No active trip. Start a trip to see alerts.'}</Empty> :
            live.map((a) => (
              <div className={'alert ' + a.status} key={a.id}>
                <div className="between"><b>{J[a.jid].name}</b><Pill tone={ALERT_TONE[a.status]}>{a.status}</Pill></div>
                <p>ETA <b>{fmt(etaTo(s, a.jid) ?? 0)}</b> - approaching from the {J[a.jid].dir} - {s.type === 'fire' ? 'Fire truck' : 'Ambulance'} {s.vehicle}</p>
                <p><b>Action:</b> {s.type === 'fire' ? 'Prepare turning path' : 'Keep intersection clear'}</p>
                <div className="actions">
                  <button className="btn primary" disabled={a.status === 'acknowledged'} onClick={() => d({ type: 'ACK_ALERT', id: a.id, jid: a.jid })}>{a.status === 'acknowledged' ? 'Acknowledged' : 'Acknowledge'}</button>
                  <button className="btn" onClick={() => d({ type: 'FOCUS', id: a.jid })}><MapPin size={14} /> Focus on map</button>
                </div>
              </div>))}
          {old.map((a) => <div className="alert superseded" key={a.id}><b>{J[a.jid].name}</b> <Pill tone="amber">superseded</Pill> <small className="muted">No longer on the selected route.</small></div>)}
        </Card>
        <Card title="Report road blockage">
          <div className="form">
            <label>Reason<input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Broken-down truck on Demo Circle" /></label>
            {err && <small className="err">{err}</small>}
            <button className="btn danger" onClick={report}>Report blockage and switch to Route B</button>
          </div>
        </Card>
      </div>
      <div className="col wide"><TripStatus /><MapView tall /><Timeline /></div>
    </div>
  )
}

// ---------- Signal control ----------
export function SignalView() {
  const { s } = useSim()
  return (
    <div className="grid">
      <div className="col wide">
        <Card title="Simulated signal dashboard">
          <p className="note">Simulator only. Not connected to any real government signal controller.</p>
          {s.status === 'idle' ? <Empty>No active trip. Signals are all Normal.</Empty> : null}
          <table><thead><tr><th>Junction</th><th>Approach</th><th>ETA</th><th>On selected route</th><th>Signal state</th></tr></thead>
            <tbody>{Object.keys(J).map((id) => {
              const on = ROUTES[s.route].js.some((x) => x.id === id)
              return <tr key={id} className={on ? '' : 'dim'}><td>{J[id].name}</td><td>{J[id].dir}</td>
                <td>{on && moving(s) && !s.passed.includes(id) ? fmt(etaTo(s, id)) : '-'}</td><td>{on ? 'Yes' : 'No'}</td>
                <td><Pill tone={SIG_TONE[s.signals[id]]}>{SIG_LABEL[s.signals[id]]}</Pill></td></tr>
            })}</tbody></table>
        </Card>
        <Timeline />
      </div>
      <div className="col"><TripStatus /><MapView /></div>
    </div>
  )
}

// ---------- Nearby driver ----------
const LEVELS = {
  clear: { tone: 'gray', title: 'Corridor clear', steps: ['No emergency vehicle is approaching your corridor right now.', 'Drive normally and keep your lane discipline.'] },
  prepare: { tone: 'amber', title: 'Prepare', steps: ['Check your mirrors and listen for sirens.', 'Do not stop inside the junction box.', 'Start planning where you can pull to the left.'] },
  slow: { tone: 'red', title: 'Slow down and move left', steps: ['Reduce speed and move to the left edge when safe.', 'Leave the stop line and junction area clear.', 'Do not follow the emergency vehicle.'] },
  yield: { tone: 'red', title: 'Yield now', steps: ['Stop at the left edge when safe and let the vehicle pass.', 'Do not jump the signal or block the turning path.', 'Resume only after the vehicle has fully passed.'] },
}

export function DriverView() {
  const { s } = useSim()
  const [voice, setVoice] = useState(false)
  const m = driverMessage(s)
  const ok = 'speechSynthesis' in window
  const speak = (t) => { if (!ok) return; window.speechSynthesis.cancel(); window.speechSynthesis.speak(new SpeechSynthesisUtterance(t)) }
  useEffect(() => { if (voice && m.speak) speak(m.text) }, [m.text, voice])
  useEffect(() => () => ok && window.speechSynthesis.cancel(), [])

  const eta = m.speak ? etaTo(s, m.jid) : null
  const key = !m.speak ? 'clear' : eta > 2 ? 'prepare' : eta > 1 ? 'slow' : 'yield'
  const L = LEVELS[key]
  const who = s.type === 'fire' ? 'Fire truck' : 'Ambulance'
  const history = s.events.filter((e) => /Alert issued|Rerouted|passed/.test(e.text)).slice(0, 6)

  return (
    <div className="grid">
      <div className="col wide">
        <Card title="Corridor alert">
          <p className="note">Alerts are based on the planned route corridor and upcoming junctions. No radius broadcast and no phone tracking.</p>
          {s.block && moving(s) && <p className="reroute"><Pill tone="amber">Route changed</Pill> Emergency vehicle is now on {ROUTES.B.label}. Corridor alerts have been updated.</p>}
          <div className={'warn ' + (m.speak ? 'on' : '')}>
            <ShieldAlert size={24} />
            <div>
              <b>{m.speak ? `${who} approaching` : 'No alert'}</b>
              <p>{m.text}</p>
              {m.speak && <p><Pill tone={L.tone}>{L.title}</Pill> Arriving at {J[m.jid].name} in <b>{fmt(eta)}</b></p>}
            </div>
          </div>
        </Card>
        <Card title="Your corridor: upcoming junctions">
          {s.status === 'idle' ? <Empty>No trip in progress. Corridor status will appear here when an emergency vehicle is dispatched.</Empty> : (
            <div className="strip">{ROUTES[s.route].js.map(({ id }) => {
              const st = s.passed.includes(id) ? 'Passed' : id === m.jid ? 'Next - alert active' : 'Upcoming'
              return <div key={id} className={'stop ' + (id === m.jid ? 'now' : s.passed.includes(id) ? 'done' : '')}><b>{J[id].name}</b><small>from the {J[id].dir}</small><Pill tone={id === m.jid ? 'red' : 'gray'}>{st}</Pill></div>
            })}</div>)}
        </Card>
        <MapView />
      </div>
      <div className="col">
        <Card title={'What to do now: ' + L.title}>
          <ol className="steps">{L.steps.map((x) => <li key={x}>{x}</li>)}</ol>
          {m.speak && s.type === 'fire' && <p className="muted">Fire truck needs a wide turning path: keep the junction corners clear.</p>}
        </Card>
        <Card title="Voice alerts (optional)">
          <p className="note">Simulated. Works only while this page is open, after you enable it. Every spoken message is also shown as text above. Not the official Cell Broadcast alert.</p>
          {!ok && <small className="err">Speech synthesis is not supported in this browser.</small>}
          <div className="actions">
            <button className="btn primary" disabled={!ok || voice} onClick={() => setVoice(true)}><Volume2 size={14} /> Enable voice alerts</button>
            <button className="btn" disabled={!voice} onClick={() => speak('Emergency vehicle approaching the next junction from the south. Keep the intersection clear and yield when safe.')}>Test voice alert</button>
            <button className="btn" disabled={!voice} onClick={() => { setVoice(false); ok && window.speechSynthesis.cancel() }}><VolumeX size={14} /> Mute</button>
          </div>
          <p>Voice: <Pill tone={voice ? 'teal' : 'gray'}>{voice ? 'Enabled' : 'Off'}</Pill></p>
        </Card>
        <Card title="Recent corridor updates">
          {history.length === 0 ? <Empty>No updates yet.</Empty> : <ul className="timeline">{history.map((e, i) => <li key={i}><time>{e.t}</time>{e.text}</li>)}</ul>}
        </Card>
        <Card title="Do and don't">
          <ul className="dd"><li>Do: move left, slow down, keep junctions clear.</li><li>Do: give way only when it is safe.</li><li>Don't: follow the vehicle closely or race ahead of it.</li><li>Don't: stop in the middle of an intersection.</li></ul>
        </Card>
        <details className="presenter"><summary>Presenter demo controls (not for drivers)</summary>
          <p className="muted">Trips are started by the ambulance or fire crew, not by drivers. Use these to rehearse the demo.</p>
          <Controls role="driver" presenter />
        </details>
      </div>
    </div>
  )
}
