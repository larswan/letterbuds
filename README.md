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

**Production:**

```bash
# Build for production
npm run build

# Start production server (serves both frontend and API)
npm start
```

## Deployment

This app can be deployed to Render (free tier), Railway, or Heroku.

### Render Deployment (Recommended - Free Tier)

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
6. Click "Create Web Service"
7. Wait for deployment (first build takes a few minutes)

**Note**: Free tier spins down after 15 minutes of inactivity. First request after spin-down may take ~30 seconds.

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

