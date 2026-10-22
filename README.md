# Health-Wave - Coordinated Emergency Corridor (Frontend Demo)

Self-contained React + Vite simulation. No backend, API keys, SMS, database or real data.
Everything is a **simulation** using fake demo coordinates and fake patient data.

## Run (Windows PowerShell)
Install Node.js LTS (https://nodejs.org) first, then:

```powershell
node -v
cd frontend
npm install
npm run dev
```
Open the address shown (usually http://localhost:5173). To stop: Ctrl+C.
If PowerShell blocks npm, run `Set-ExecutionPolicy -Scope Process Bypass` or use `npm.cmd install` and `npm.cmd run dev`.

Production check: `npm run build`

## Demo walkthrough
1. Pick **Ambulance Driver / EMT** > **Start ambulance trip** (speed 3x).
2. Watch the marker move; use **Fast-forward** to reach alerts quickly.
3. Send the demo pre-alert; the hospital reply is auto-simulated after ~3 seconds.
4. Switch role > Traffic Police: Acknowledge, then report a blockage (Route B).
5. Check Signal Control and Nearby Driver (enable voice, see urgency level and guidance).
6. **Complete trip**, then **Reset demo** and repeat.

## Not connected / simulated
Traffic signals, police alerts (SMS/WhatsApp concept only), hospital notification and reply, voice alerts
(browser speech, active page only; not Cell Broadcast), and vehicle position.
Map tiles come from OpenStreetMap; offline, a fallback route view is shown.
