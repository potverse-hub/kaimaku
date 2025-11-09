# Kaimaku - Anime Opening Ratings

A minimalistic website for rating anime openings with a unique UI/UX.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the server:**
   ```bash
   npm start
   ```

3. **Open in browser:**
   - Open `http://localhost:3000` in your browser
   - The server will automatically create `ratings.json` to store all ratings
   - Or open `index.html` directly (ratings will be local-only without the server)

## How It Works

- **With Server Running**: Ratings are saved to `ratings.json` and shared across all users
- **Without Server**: Ratings are stored locally in your browser only

The server automatically creates `ratings.json` on first run. All ratings are stored in this single file - no external databases needed!

## Features

- Search any anime opening
- Play openings directly in the website
- Rate openings on a 0-10 scale
- Featured openings carousel (current season)
- Public leaderboard of top-rated openings
- Minimalistic black theme with gradient animations

## Files

- `index.html` - Main HTML file
- `styles.css` - All styling
- `script.js` - Main application logic
- `server.js` - Simple Node.js server for storing ratings
- `ratings.json` - Database file (created automatically)
- `package.json` - Node.js dependencies

## Requirements

- Node.js (for the server)
- Modern web browser

That's it! No external APIs, no complex setup - just install and run. 🎉

