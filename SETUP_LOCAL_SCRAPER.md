# Setting Up Local Scraper Service

## Right Now - Initial Setup

### Step 1: Install Docker (if not already installed)
- **macOS**: Download [Docker Desktop](https://www.docker.com/products/docker-desktop)
- **Linux**: `sudo apt-get install docker.io docker-compose` (or use your distro's package manager)
- **Windows**: Download [Docker Desktop](https://www.docker.com/products/docker-desktop)

Verify installation:
```bash
docker --version
docker-compose --version
```

### Step 2: Create Environment File
```bash
cp .env.example .env
```

The `.env` file is already configured to use `http://localhost:5000` (local scraper).

### Step 3: Start the Scraper Service
```bash
npm run dev:scraper
```

This will:
- Pull the latest `letterboxd-list-radarr` Docker image
- Start Redis (port 6379)
- Start the scraper service (port 5000)

**First time setup takes 1-2 minutes** (downloading Docker images)

### Step 4: Verify It's Running
```bash
# Check if services are up
docker-compose ps

# View scraper logs
npm run dev:scraper:logs
```

You should see the scraper service running and Redis connected.

### Step 5: Start Your App (as usual)
```bash
# Terminal 1: Express server
npm run dev:server

# Terminal 2: Vite dev server
npm run dev
```

The app will now use your local scraper instead of the hosted one!

## Testing

Try fetching a watchlist - it should work much more reliably now. Check the server logs to confirm it's using `http://localhost:5000`.

---

## Future - Keeping It Updated

### Option 1: Manual Updates (Recommended)

When you want to get the latest scraper fixes:

```bash
# Stop the service
npm run dev:scraper:stop

# Pull latest Docker image
docker-compose pull

# Start again
npm run dev:scraper
```

**When to update:**
- If you notice scraping failures (Letterboxd changed their HTML)
- Every few weeks to get latest fixes
- When the maintainer releases updates (check [GitHub repo](https://github.com/screeny05/letterboxd-list-radarr))

### Option 2: Automatic Updates (Advanced)

You can set up a cron job or scheduled task to auto-update:

```bash
# Add to crontab (runs weekly on Sunday at 2 AM)
0 2 * * 0 cd /path/to/LetterBoxd-Buddy && docker-compose pull && docker-compose up -d
```

### Daily Usage

**Starting the scraper:**
```bash
npm run dev:scraper
```

**Stopping the scraper:**
```bash
npm run dev:scraper:stop
```

**Viewing logs (if something's wrong):**
```bash
npm run dev:scraper:logs
```

**Checking status:**
```bash
docker-compose ps
```

---

## Troubleshooting

### Scraper won't start
```bash
# Check Docker is running
docker ps

# Check for port conflicts
lsof -i :5000  # macOS/Linux
netstat -ano | findstr :5000  # Windows
```

### Redis connection errors
```bash
# Restart everything
npm run dev:scraper:stop
docker-compose down -v  # Removes volumes too
npm run dev:scraper
```

### Still getting 503 errors
- Check if scraper is actually running: `docker-compose ps`
- Check logs: `npm run dev:scraper:logs`
- Verify `.env` file has `WATCHLIST_API_BASE=http://localhost:5000`
- Restart the Express server after changing `.env`

---

## Benefits Summary

✅ **More reliable** - No 503 errors from free tier  
✅ **Always up-to-date** - Get latest fixes when you update  
✅ **No rate limits** - Your own instance  
✅ **Full control** - Can modify if needed  

