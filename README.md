# Kaimaku - Anime Opening Ratings

A minimalistic website for rating every anime opening with interesting site interactions and a unique UI/UX.

## Features

- 🎬 **Rate Every Opening** - Rate anime openings from 1-10
- 🎵 **Song Information** - Displays song titles and artists
- 🔍 **Advanced Search** - Search by anime name, filter by year, season, rating
- 📊 **Leaderboard** - See top-rated openings
- 🎲 **Discovery** - Random openings, trending, daily featured
- 🎨 **Modern UI** - Dark/light theme, smooth animations
- 🔐 **User Accounts** - Register and login to save your ratings
- 💾 **Persistent Storage** - PostgreSQL database (via Supabase)

## Tech Stack

- **Frontend**: HTML, CSS, JavaScript
- **Backend**: Node.js, Express
- **Database**: PostgreSQL (Supabase)
- **API**: AnimeThemes.moe API

## Setup

### Prerequisites

- Node.js (v14+)
- PostgreSQL database (Supabase free tier recommended)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/potverse-hub/kaimaku.git
   cd kaimaku
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up database**
   - Create a Supabase account: https://supabase.com
   - Create a new project
   - Get your database connection string
   - See `SUPABASE_SETUP.md` for detailed instructions

4. **Configure environment variables**
   Create a `.env` file:
   ```env
   DATABASE_URL=postgresql://postgres:password@host:5432/postgres
   SESSION_SECRET=your-secret-key-here
   NODE_ENV=development
   ```

5. **Start the server**
   ```bash
   npm start
   ```

6. **Open in browser**
   ```
   http://localhost:3000
   ```

## Deployment

### Render (Free Tier)

1. Push code to GitHub
2. Create account at https://render.com
3. Create new Web Service
4. Connect GitHub repository
5. Add environment variables:
   - `DATABASE_URL` - Your Supabase connection string
   - `SESSION_SECRET` - Random secret key
   - `NODE_ENV` - `production`
6. Deploy!

See `DEPLOYMENT.md` for detailed deployment instructions.

### Supabase Setup

See `SUPABASE_SETUP.md` for PostgreSQL database setup.

## Environment Variables

- `DATABASE_URL` - PostgreSQL connection string (required)
- `SESSION_SECRET` - Secret key for session encryption (required)
- `NODE_ENV` - Environment (development/production)
- `ALLOWED_ORIGINS` - Comma-separated list of allowed CORS origins
- `PORT` - Server port (default: 3000)

## Project Structure

```
kaimaku/
├── index.html          # Main HTML file
├── styles.css          # All styles
├── script.js           # Frontend JavaScript
├── server.js           # Express server
├── database.js         # PostgreSQL database functions
├── package.json        # Dependencies
└── README.md          # This file
```

## Features in Detail

### Rating System
- Rate openings from 1-10
- Instant rating buttons (1-10)
- Slider for precise ratings
- Color-coded ratings based on value
- Aggregated public ratings

### Search & Filter
- Search by anime name
- Filter by year, season, genre
- Filter by rating range
- Sort by relevance, rating, popularity, year, alphabetical
- Centered results for 1-3 items

### Discovery
- Random opening button (R key)
- Trending openings
- Daily featured opening
- Current season anime

### User Interface
- Dark/light theme toggle
- Grid/list view toggle
- Keyboard shortcuts (Space, R, Escape)
- Smooth animations
- Responsive design
- Song information display

## API

Uses [AnimeThemes.moe API](https://api.animethemes.moe) for:
- Anime data
- Opening themes
- Video URLs
- Song information
- Artist names

## License

ISC

## Contributing

Feel free to submit issues and pull requests!
