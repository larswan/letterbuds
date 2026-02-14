# Letterboxd Buddy

A mobile-first web app that compares two Letterboxd watchlists to find common films. Built with React, TypeScript, and SCSS.

## Features

- Compare two Letterboxd watchlists
- Find common films between users
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

This app is configured for Heroku deployment using the `Procfile`.

### Heroku Deployment Steps

1. Create a Heroku app
2. Push to Heroku: `git push heroku main`
3. The `Procfile` will automatically run `npm start` which builds and serves the app

The Express server handles:
- API proxy requests to letterboxd-list-radarr (bypasses CORS)
- Serving the React frontend in production

The app uses the letterboxd-list-radarr API service hosted at `https://letterboxd-list-radarr.onrender.com`.

## API Integration

The app fetches watchlists from the letterboxd-list-radarr service:
- Endpoint: `https://letterboxd-list-radarr.onrender.com/{username}/watchlist/`
- Returns Radarr-compatible JSON format with film data

## License

MIT

