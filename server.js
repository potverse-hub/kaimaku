// Node.js server with PostgreSQL database
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:3000'];

// Add Render URL automatically if in production
if (process.env.NODE_ENV === 'production' && process.env.RENDER_EXTERNAL_URL) {
    allowedOrigins.push(process.env.RENDER_EXTERNAL_URL);
}

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (mobile apps, curl, etc.)
        if (!origin) return callback(null, true);
        
        // In production, check against allowed origins
        if (process.env.NODE_ENV === 'production') {
            if (allowedOrigins.indexOf(origin) !== -1) {
                callback(null, true);
            } else {
                console.warn(`CORS blocked origin: ${origin}. Allowed: ${allowedOrigins.join(', ')}`);
                callback(new Error('Not allowed by CORS'));
            }
        } else {
            // In development, allow all origins
            callback(null, true);
        }
    },
    credentials: true
}));
app.use(express.json());

// Configure session store (use PostgreSQL in production, MemoryStore in development)
const sessionConfig = {
    secret: process.env.SESSION_SECRET || 'kaimaku-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    name: 'kaimaku.sid', // Custom session name
    cookie: { 
        secure: process.env.NODE_ENV === 'production', // HTTPS in production
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: 'lax', // 'lax' works for same-site requests
        path: '/' // Ensure cookie is available for all paths
        // Don't set domain - let browser handle it automatically
    }
};

// Use PostgreSQL session store in production, MemoryStore in development
if (process.env.NODE_ENV === 'production' && process.env.DATABASE_URL) {
    try {
        sessionConfig.store = new pgSession({
            pool: db.pool,
            tableName: 'user_sessions', // Table name for sessions
            createTableIfMissing: true, // Automatically create table if it doesn't exist
            pruneSessionInterval: false // Disable automatic pruning (Supabase handles it)
        });
        console.log('✅ Using PostgreSQL session store');
    } catch (error) {
        console.error('❌ Error setting up PostgreSQL session store:', error);
        console.log('⚠️  Falling back to MemoryStore (not recommended for production)');
    }
} else {
    console.log('⚠️  Using MemoryStore (development mode)');
}

app.use(session(sessionConfig));

// Session debugging middleware (only in development)
if (process.env.NODE_ENV !== 'production') {
    app.use((req, res, next) => {
        console.log('Session middleware:', {
            sessionId: req.sessionID,
            userId: req.session.userId,
            url: req.url
        });
        next();
    });
}

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
        // Save session explicitly
        req.session.save((err) => {
            if (err) {
                console.error('Error saving session:', err);
                return res.status(500).json({ error: 'Failed to save session' });
            }
            res.json({ success: true, username });
        });
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
        // Save session explicitly to ensure it's persisted
        req.session.save((err) => {
            if (err) {
                console.error('Error saving session:', err);
                return res.status(500).json({ error: 'Failed to save session' });
            }
            res.json({ success: true, username });
        });
    } catch (error) {
        console.error('Error logging in:', error);
        res.status(500).json({ error: 'Failed to login' });
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error destroying session:', err);
            return res.status(500).json({ error: 'Failed to logout' });
        }
        res.json({ success: true });
    });
});

app.get('/api/me', (req, res) => {
    // Debug session info (only in development)
    if (process.env.NODE_ENV !== 'production') {
        console.log('Session check:', {
            sessionId: req.sessionID,
            userId: req.session.userId,
            cookie: req.headers.cookie ? 'present' : 'missing'
        });
    }
    
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

// Start server immediately, initialize database in background
// This ensures Render detects the port quickly
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n✅ Server running on port ${PORT}`);
    console.log(`🌐 Server is ready to accept connections\n`);
    
    // Initialize database in background (non-blocking)
    initializeDatabaseInBackground();
});

// Handle server errors
server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use`);
    } else {
        console.error('❌ Server error:', error);
    }
    process.exit(1);
});

// Initialize database in background
async function initializeDatabaseInBackground() {
    try {
        console.log('🔄 Initializing database...');
        
        // Set a timeout for database connection (30 seconds)
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Database connection timeout')), 30000)
        );
        
        const dbInitPromise = db.initializeDatabase();
        const dbInitialized = await Promise.race([dbInitPromise, timeoutPromise]);
        
        if (dbInitialized) {
            console.log('✅ Database initialized successfully');
            console.log('🗄️  Database: PostgreSQL');
        } else {
            console.warn('⚠️  Database initialization returned false');
        }
    } catch (error) {
        console.error('⚠️  Database initialization failed:', error.message);
        console.error('💡 Server will continue but database features may not work');
        console.error('💡 Check your DATABASE_URL environment variable');
        console.error('💡 Error details:', error.message);
        // Don't exit - let server continue running
        // Database might connect later, or we can retry
    }
}
