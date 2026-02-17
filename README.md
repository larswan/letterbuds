# Letterboxd Buddy

A mobile-first web app that compares two Letterboxd watchlists to find common films. Built with React, TypeScript, and SCSS.

## Features

- Compare up to 10 Letterboxd watchlists simultaneously
- Find common films across all user combinations
- Username validation with avatar display
- Grouped results by user combinations
- Mobile-first responsive design
- Dark mode only
- Real-time console logging for debugging

## Tech Stack

- React + TypeScript
- Vite
- SCSS
- Fetch API

## Development

The app uses a proxy server to handle CORS issues with the letterboxd-list-radarr API.

### Option 1: Use Hosted API (Easier, but less reliable)

**To run in development, you need two terminals:**

```bash
# Install dependencies
npm install

# Terminal 1: Start the Express proxy server
npm run dev:server

# Terminal 2: Start the Vite dev server
npm run dev
```

The Vite dev server will proxy `/api` requests to the Express server running on port 3000.

### Option 2: Run Local Scraper Service (Recommended - More Reliable)

Running the `letterboxd-list-radarr` service locally gives you:
- ✅ More reliability (no 503 errors from free tier)
- ✅ Always up-to-date with latest scraper fixes
- ✅ No shared rate limits

**Setup:**

1. **Install Docker** (if not already installed):
   - macOS: [Docker Desktop](https://www.docker.com/products/docker-desktop)
   - Linux: `sudo apt-get install docker.io docker-compose`

2. **Start the scraper service:**
   ```bash
   docker-compose up -d
   ```
   This starts:
   - Redis (on port 6379)
   - letterboxd-list-radarr service (on port 5000)

3. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env and ensure WATCHLIST_API_BASE=http://localhost:5000
   ```

4. **Start the app (two terminals):**
   ```bash
   # Terminal 1: Express proxy server
   npm run dev:server

   # Terminal 2: Vite dev server
   npm run dev
   ```

**To stop the scraper service:**
```bash
npm run dev:scraper:stop
```

**To update the scraper to latest version:**
```bash
npm run dev:scraper:stop
docker-compose pull
npm run dev:scraper
```

**For detailed setup and maintenance instructions, see [SETUP_LOCAL_SCRAPER.md](./SETUP_LOCAL_SCRAPER.md)**

**Production:**

```bash
# Build for production
npm run build

# Start production server (serves both frontend and API)
npm start
```

**Important**: Set `NODE_ENV=production` in your production environment variables.

The app includes a health check endpoint at `/health` (production only) that monitors scraper functionality. See `.admin/README.md` for monitoring setup and maintenance instructions.

## Deployment

This app can be deployed to Railway (recommended), Render, or other Node.js hosting platforms.

### Railway Deployment (Recommended - Best Free Tier)

1. Sign up at [railway.app](https://railway.app) (free $5 credit/month)
2. Connect your GitHub account
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your repository: `larswan/letterbuds`
5. Railway will auto-detect Node.js and start deploying
6. **Environment Variables** (click "Variables" tab):
   - `NODE_ENV` = `production`
   - (Optional) `WATCHLIST_API_BASE` = `http://localhost:5000` if running local scraper
7. Wait for deployment (first build takes a few minutes)
8. Get your app URL: `https://your-app.up.railway.app`
9. **Add Custom Domain** (Settings → Domains):
   - Add your domain
   - Follow DNS instructions to point domain to Railway

**Benefits:**
- ✅ Best free tier ($5 credit/month, usually enough)
- ✅ More reliable than Render free tier
- ✅ Supports Docker (can run scraper service)
- ✅ Easy GitHub integration

### Render Deployment (Alternative - Free Tier)

1. Sign up at [render.com](https://render.com) (free)
2. Connect your GitHub account
3. Click "New +" → "Web Service"
4. Select your repository: `larswan/letterbuds`
5. Configure:
   - **Name**: `letterboxd-buddy` (or your choice)
   - **Environment**: Node
   - **Branch**: `main`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
6. **Environment Variables** (click "Environment" tab):
   - `NODE_ENV` = `production`
   - (Optional) `WATCHLIST_API_BASE` = `http://localhost:5000` if running local scraper
7. Click "Create Web Service"
8. Wait for deployment (first build takes a few minutes)

**Note**: Free tier spins down after 15 minutes of inactivity. First request after spin-down may take ~30 seconds.

**After Deployment:**
- Test health endpoint: `https://your-app.onrender.com/health`
- Set up monitoring (see `.admin/README.md`)

### Domain Setup

**Recommended: Cloudflare Registrar** (best value)
1. Go to [Cloudflare Registrar](https://www.cloudflare.com/products/registrar/)
2. Search for your domain (e.g., `letterbuds.com`)
3. Purchase (~$8-12/year for .com)
4. Privacy protection is included for free
5. Point DNS to your hosting platform (Railway/Render will provide instructions)

**See `.admin/README.md` for complete deployment checklist.**

### Railway Deployment

1. Sign up at [railway.app](https://railway.app)
2. Connect GitHub and create new project
3. Select your repository
4. Railway auto-detects Node.js and deploys
5. Add environment variable: `NODE_ENV=production` (optional, Railway sets this)

### Heroku Deployment

1. Create a Heroku app
2. Push to Heroku: `git push heroku main`
3. The `Procfile` will automatically run `npm start`

The Express server handles:
- API proxy requests to letterboxd-list-radarr (bypasses CORS)
- User profile scraping for avatars
- Serving the React frontend in production

The app uses the letterboxd-list-radarr API service hosted at `https://letterboxd-list-radarr.onrender.com`.

## API Integration

The app fetches watchlists from the letterboxd-list-radarr service:
- Endpoint: `https://letterboxd-list-radarr.onrender.com/{username}/watchlist/`
- Returns Radarr-compatible JSON format with film data

## TODO

- [ ] Add pagination support for following/followers lists (currently only shows first page)

## License

MIT

