// Node.js server with PostgreSQL database
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',') 
    : ['http://localhost:3000'];

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (mobile apps, curl, etc.)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV !== 'production') {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));
app.use(express.json());
app.use(session({
    secret: process.env.SESSION_SECRET || 'kaimaku-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production', // HTTPS in production
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: 'lax'
    }
}));

// Serve static files (HTML, CSS, JS)
app.use(express.static(__dirname));

// Seeded random function (same as client)
function seededRandom(seed) {
    return ((seed * 9301 + 49297) % 233280) / 233280;
}

// Generate CAPTCHA answer from captchaId (deterministic)
function generateCaptchaAnswer(captchaId) {
    if (!captchaId) return null;
    
    // Use same seeded random function as client
    const seed = parseInt(captchaId.slice(-8)) || 12345678;
    let currentSeed = seed;
    
    const random1 = seededRandom(currentSeed);
    currentSeed = Math.floor(currentSeed * 1.5) + 1;
    const random2 = seededRandom(currentSeed);
    currentSeed = Math.floor(currentSeed * 1.3) + 1;
    const random3 = seededRandom(currentSeed);
    
    const num1 = Math.floor(random1 * 10) + 1;
    const num2 = Math.floor(random2 * 10) + 1;
    const operation = random3 > 0.5 ? '+' : '-';
    
    if (operation === '+') {
        return num1 + num2;
    } else {
        const larger = Math.max(num1, num2);
        const smaller = Math.min(num1, num2);
        return larger - smaller;
    }
}

// Authentication endpoints
app.post('/api/register', async (req, res) => {
    try {
        const { username, password, captchaId, captchaAnswer } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }
        
        if (username.length < 3 || username.length > 20) {
            return res.status(400).json({ error: 'Username must be 3-20 characters' });
        }
        
        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }
        
        // Verify CAPTCHA
        if (!captchaId || captchaAnswer === undefined || captchaAnswer === null) {
            return res.status(400).json({ error: 'CAPTCHA verification required' });
        }
        
        // Check if CAPTCHA is not too old (10 minutes)
        const captchaTime = parseInt(captchaId);
        if (isNaN(captchaTime) || Date.now() - captchaTime > 10 * 60 * 1000) {
            return res.status(400).json({ error: 'CAPTCHA expired. Please refresh and try again.' });
        }
        
        // Generate expected answer using same algorithm as client
        const expectedAnswer = generateCaptchaAnswer(captchaId);
        if (!expectedAnswer || parseInt(captchaAnswer) !== expectedAnswer) {
            return res.status(400).json({ error: 'CAPTCHA verification failed' });
        }
        
        // Check if user already exists
        const existingUser = await db.getUser(username);
        if (existingUser) {
            return res.status(400).json({ error: 'Username already exists' });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        await db.createUser(username, hashedPassword);
        
        req.session.userId = username;
        res.json({ success: true, username });
    } catch (error) {
        console.error('Error registering user:', error);
        res.status(500).json({ error: 'Failed to register user' });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }
        
        const user = await db.getUser(username);
        
        if (!user) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        
        req.session.userId = username;
        res.json({ success: true, username });
    } catch (error) {
        console.error('Error logging in:', error);
        res.status(500).json({ error: 'Failed to login' });
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

app.get('/api/me', (req, res) => {
    if (req.session.userId) {
        res.json({ username: req.session.userId });
    } else {
        res.status(401).json({ error: 'Not authenticated' });
    }
});

// Get all ratings
app.get('/api/ratings', async (req, res) => {
    try {
        const data = await db.getRatings();
        res.json(data);
    } catch (error) {
        console.error('Error reading ratings:', error);
        res.status(500).json({ error: 'Failed to read ratings' });
    }
});

// Save a rating (requires authentication)
app.post('/api/ratings', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        
        const { themeId, rating, metadata } = req.body;
        const userId = req.session.userId;
        
        if (!themeId || rating === undefined) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        const themeRating = await db.saveRating(themeId, userId, rating, metadata);
        
        res.json({ success: true, themeRating });
    } catch (error) {
        console.error('Error saving rating:', error);
        res.status(500).json({ error: 'Failed to save rating' });
    }
});

// Start server
async function startServer() {
    try {
        // Initialize database tables
        const dbInitialized = await db.initializeDatabase();
        if (!dbInitialized) {
            console.error('⚠️  Failed to initialize database. Make sure DATABASE_URL is set.');
            console.error('💡 For local development, you can use file storage by setting USE_FILE_STORAGE=true');
            process.exit(1);
        }
        
        app.listen(PORT, () => {
            console.log(`\n✅ Server running at http://localhost:${PORT}`);
            console.log(`🗄️  Database: PostgreSQL`);
            console.log(`\n💡 Make sure to open http://localhost:${PORT} in your browser\n`);
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

startServer().catch(console.error);
