# 🛺 Book Toto Local

A full-stack ride-hailing web app (like Ola / Uber / Rapido) for booking local totos & e-rickshaws — with rider booking, driver dispatch, live GPS tracking, admin dashboard and mock payments.

Built with the **MERN** stack:

- **Backend** — Node.js, Express, MongoDB (Mongoose), Socket.io (live tracking), JWT auth
- **Frontend** — React 18, Vite, React Router, React Leaflet (OpenStreetMap), Axios, Socket.io client

## Features

| Area | What you get |
| --- | --- |
| 👤 Rider | Pick pickup/drop on map, live fare estimate, request a toto, track driver in real time, cancel, mock UPI payment, rate the driver, ride history |
| 🛺 Driver | Online/offline toggle, receive ride requests with a 25s accept window, arrive → start → complete trip, rate the rider, earnings summary, simulated GPS |
| 🛠️ Admin | Live stats (riders, drivers online, rides, revenue), approve / block driver accounts, view all rides & riders |
| 🔌 Live | WebSocket streaming of driver location to rider; nearest-driver dispatch queue with timeout fallback |

## Quick start

```bash
npm install
npm run dev
```

Then open:

- Rider app: **http://localhost:5173**
- API: **http://localhost:5173/api** (proxied to `:5000`)

`npm run dev` starts the API server (port 5000) and the Vite client (port 5173) together.

## Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Rider | `rider@booktoto.local` | `demo123` |
| Driver | `driver@booktoto.local` | `demo123` |
| Admin | `admin@booktoto.local` | `demo123` |

> Tip: open two browser windows — rider in one, driver in the other — and book a ride to watch the live dispatch and tracking.

## Live demo walkthrough

1. Log in as **driver** → keep the driver window open, make sure it is **online**.
2. Log in as **rider** → pick a pickup & drop, see the fare estimate, tap **Request toto**.
3. The driver window receives a request modal → tap **Accept**.
4. The rider sees the toto 🛺 approach on the map (driver GPS is simulated so it works anywhere).
5. Driver: **arrived → start trip → complete trip**.
6. Rider: **Pay** (mock UPI) → **rate the driver**.

## Data storage

- By default the app uses **MongoDB in-memory** (`mongodb-memory-server`), so it runs with zero setup — but data resets every restart. Seed data is created automatically on first boot.
- To use a persistent database, create `server/.env`:

```
MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>/booktoto
JWT_SECRET=change-me
```

Then re-run `npm run dev` (or `npm run seed` to force-seed demo data into an empty DB).

## Project structure

```
server/src
  config/db.js        MongoDB connection (memory or MONGODB_URI)
  models/             User, Ride
  middleware/         JWT auth + roles, error handling
  routes/             auth, rides, driver, admin
  socket.js           live tracking, ride dispatch queue
  seed.js             demo users & rides
client/src
  api/client.js       Axios instance (JWT header, 401 redirect)
  context/            AuthContext, SocketContext
  components/         MapView (Leaflet), RideTracker, Nav, Modal
  pages/              Landing, Login, Register, RiderHome, DriverHome, AdminDashboard, RideHistory, Profile
```

## Useful scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run API + client with hot reload |
| `npm run dev:server` | API only |
| `npm run dev:client` | Client only |
| `npm run seed` | Force-seed demo data |
| `npm run build` | Production build of the client |

## Fare model

`base ₹30 + ₹14/km + ₹1.5/min`, minimum ₹40, optional surge multiplier — see `server/src/utils/pricing.js`.

## Notes

- **Driver GPS** is simulated in the demo (a small random walk / route-following), so you can try the full flow without real device sensors. A real driver app would stream browser `navigator.geolocation` instead — the socket event (`driver:location`) is identical.
- **Payments** are mocked end-to-end (no real money).
- Map tiles come from OpenStreetMap (free, no API key needed).
