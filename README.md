# Letterbuds

A mobile-first web app that compares Letterboxd watchlists to find common films. Built with React, TypeScript, and SCSS.

## Features

- Compare up to 10 Letterboxd watchlists simultaneously
- Find common films across all user combinations
- Username validation with avatar and empty-watchlist check
- “Find Friends” suggestions from a user’s following list
- Grouped results by user combinations; film modal with trailer and details
- Mobile-first responsive design, dark theme

## Tech Stack

- React, TypeScript, Vite, SCSS
- Express proxy (CORS, profile scraping, watchlist API)
- letterboxd-list-radarr API for watchlist data

## Development

You need two terminals: one for the Express proxy server and one for the Vite dev server.

### Option 1: Hosted API (simplest, less reliable)

```bash
npm install

# Terminal 1
npm run dev:server

# Terminal 2
npm run dev
```

Vite proxies `/api` to the Express server on port 3000.

### Option 2: Local scraper (recommended, more reliable)

1. **Install Docker** (e.g. [Docker Desktop](https://www.docker.com/products/docker-desktop)).
2. **Start the scraper:**
   ```bash
   docker-compose up -d
   ```
   Runs Redis (6379) and letterboxd-list-radarr (5000).
3. **Environment:**
   ```bash
   cp .env.example .env
   # Set WATCHLIST_API_BASE=http://localhost:5000 in .env
   ```
4. **Run the app** (same as Option 1: `npm run dev:server` + `npm run dev` in two terminals).

Stop scraper: `npm run dev:scraper:stop`.  
For full setup and maintenance, see [SETUP_LOCAL_SCRAPER.md](./SETUP_LOCAL_SCRAPER.md).

### Production build

```bash
npm run build
npm start
```

Set `NODE_ENV=production` in production. The `/health` endpoint (production) checks scraper connectivity.

## Deployment

### Railway (recommended)

1. Sign up at [railway.app](https://railway.app), connect GitHub.
2. New Project → Deploy from GitHub → select `larswan/letterbuds`.
3. Variables: `NODE_ENV=production`. Optionally set `WATCHLIST_API_BASE` if using a custom scraper.
4. Deploy; add a custom domain under Settings → Domains if desired.

### Render

1. New + → Web Service, connect repo.
2. Build: `npm install && npm run build`. Start: `npm start`.
3. Environment: `NODE_ENV=production`.
4. Free tier sleeps after inactivity; first request after wake can be slow.

### Other platforms

- **Heroku:** `Procfile` runs `npm start`; push with `git push heroku main`.
- **Domain:** Use Cloudflare Registrar or your registrar; point DNS to your host.

The Express server proxies requests to the watchlist API, scrapes Letterboxd profiles (avatars, watchlist check), and serves the built React app in production.

## API

Watchlists are fetched from the letterboxd-list-radarr service (default: `https://letterboxd-list-radarr.onrender.com`).  
Endpoint shape: `{WATCHLIST_API_BASE}/{username}/watchlist/` (Radarr-compatible JSON).

## Troubleshooting

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for logs, 403/503 handling, and local scraper tips.

## TODO

- [ ] Colored borders on username inputs instead of side circles
- [ ] Add explainer text above the main input section
- [ ] Copy letterboxd spacing and style rules
- [ ] Set favicon as logo
- [ ]
- [ ]
- [ ] Improve film modal layout
- [ ] Email/notification when key features break
- [ ] Fix click-out behavior for dropdowns
- [ ] Retry “Find Friends” and handle “[username] is not following anyone”
- [ ] Pagination for following/followers lists
- [ ] Wrap username input fields in colored borders instead of having color circles t the right side
- [ ] Improve the popup display layout on each movie
- [ ] Impliment email notfication flags when certain features stop working
- [ ] Move 'Compare another' under 'Match Results" and make it just linked text with a back arrow like "<- Compare another"
- [ ] Fix click out issues with dropdowns
- [ ] Retry following list feature, adding "[username] is not following any other users"
- [ ] Add short fade in/out to modal showing/hiding
- [ ] Add pagination support for following/followers lists (currently only shows first page)

## License

MIT
