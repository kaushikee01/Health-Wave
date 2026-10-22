import React from 'react'
import { createRoot } from 'react-dom/client'
import 'leaflet/dist/leaflet.css'
import './styles.css'
import App from './App.jsx'
import { SimProvider } from './sim.jsx'
import { LiveProvider } from './live.jsx'

// If VITE_API_URL is set, the app talks to the backend. Otherwise it runs the built-in local simulation.
const Provider = import.meta.env.VITE_API_URL ? LiveProvider : SimProvider
createRoot(document.getElementById('root')).render(<Provider><App /></Provider>)
