import React from 'react'
import { createRoot } from 'react-dom/client'
import 'leaflet/dist/leaflet.css'
import './styles.css'
import App from './App.jsx'
import { SimProvider } from './sim.jsx'
createRoot(document.getElementById('root')).render(<SimProvider><App /></SimProvider>)
