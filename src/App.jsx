import { useState } from 'react'
import { Ambulance, Flame, Siren, TrafficCone, Car, ArrowRight } from 'lucide-react'
import { useSim } from './sim.jsx'
import { AmbulanceView, FireView, PoliceView, SignalView, DriverView, Controls } from './roles.jsx'

const ROLES = [
  { id: 'ambulance', nav: 'Ambulance', title: 'Ambulance Driver / EMT', icon: Ambulance, view: AmbulanceView, short: 'Run the trip, send the pre-alert',
    desc: 'Run the trip, watch ETA and junctions, send a demo hospital pre-alert and see reroutes.', points: ['Live route and ETA to every junction', 'Demo hospital pre-alert with auto reply', 'Automatic reroute on blockage'] },
  { id: 'fire', nav: 'Fire truck', title: 'Fire Truck Crew', icon: Flame, view: FireView, short: 'Clearance and turning paths',
    desc: 'Incident route, large-vehicle clearance and turning-path notes for each junction.', points: ['Incident location and route', 'Tight-turn and clearance notes', 'Police alert status per junction'] },
  { id: 'police', nav: 'Police', title: 'Traffic Police', icon: Siren, view: PoliceView, short: 'Junction alerts and blockages',
    desc: 'An upcoming-junction alert console. Acknowledge alerts and report road blockages.', points: ['Alerts only for junctions ahead', 'One-tap acknowledge and map focus', 'Blockage report triggers Route B'] },
  { id: 'signal', nav: 'Signals', title: 'Traffic Signal Control', icon: TrafficCone, view: SignalView, short: 'Simulated green corridor',
    desc: 'Simulated signal state per junction as the green corridor activates and clears.', points: ['Corridor requested, green, returned', 'Only junctions on the active route', 'Simulator only, no real controllers'] },
  { id: 'driver', nav: 'Driver', title: 'Nearby Driver', icon: Car, view: DriverView, short: 'Corridor warning and guidance',
    desc: 'Corridor-based warning with urgency level, what-to-do guidance and optional voice alert.', points: ['Urgency level from vehicle ETA', 'Clear step-by-step guidance', 'Optional spoken alert in the browser'] },
]

const Logo = ({ size = 30 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" fill="#16b3a0" />
    <path d="M3 17h6l3-8 5 15 3-9 2 2h7" fill="none" stroke="#06242b" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
)

export default function App() {
  const [role, setRole] = useState(null)
  const { s } = useSim()
  const [hov, setHov] = useState(ROLES[0])
  const r = ROLES.find((x) => x.id === role)
  return (
    <div className="app">
      <header className="top">
        <button className="brand" onClick={() => setRole(null)} aria-label="Health-Wave home"><Logo /><b>Health-Wave</b></button>
        <span className="sim">SIMULATION - NOT CONNECTED TO REAL EMERGENCY SERVICES</span>
        <span className={'conn ' + (s.conn || 'local')}>{s.mode === 'live' ? `Backend: ${s.conn}` : 'Local simulation'}</span>
      </header>
      {r && <nav className="rolenav">
        {ROLES.map((x) => <button key={x.id} className={x.id === role ? 'on' : ''} onClick={() => setRole(x.id)}><x.icon size={16} />{x.nav}</button>)}
        <button className="all" onClick={() => setRole(null)}>All roles</button>
      </nav>}
      {!r ? (
        <main className="select">
          <svg className="wavebg" viewBox="0 0 1200 200" preserveAspectRatio="none" aria-hidden="true"><path d="M0 110h330l22-60 34 130 30-95 26 25h758" /></svg>
          <section className="intro">
            <Logo size={52} />
            <h1>Health<span>-</span>Wave</h1>
            <p className="tag">One planned route. Every junction coordinated before the siren arrives.</p>
            <div className="preview" key={hov.id}>
              <small>WHAT THIS ROLE SEES</small><h3>{hov.title}</h3><p>{hov.desc}</p>
              <ul>{hov.points.map((x) => <li key={x}>{x}</li>)}</ul>
            </div>
          </section>
          <section className="rolelist">
            <h2>Choose your role</h2>
            {ROLES.map((x, i) => (
              <button key={x.id} className="role" onMouseEnter={() => setHov(x)} onFocus={() => setHov(x)} onClick={() => setRole(x.id)}>
                <span className="num">0{i + 1}</span><x.icon size={24} />
                <span className="rt"><b>{x.title}</b><small>{x.short}</small></span><ArrowRight className="go" size={20} />
              </button>))}
            <p className="foot">All roles share one in-browser demo. Fake coordinates and fake patient data only.</p>
          </section>
        </main>
      ) : (
        <main className="content">
          <div className="pagehead"><div className="phi"><r.icon size={26} /></div><div><h1>{r.title}</h1><p>{r.desc}</p></div></div>
          {s.error && <p className="note">{s.error}</p>}
          {r.id !== 'driver' && <Controls role={r.id} />}
          <r.view />
        </main>
      )}
    </div>
  )
}
