// Node.js server with PostgreSQL database
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy (required for Render and other hosting services)
app.set('trust proxy', 1);

// Middleware
const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:3000'];

// Add Render URL automatically if in production
if (process.env.NODE_ENV === 'production' && process.env.RENDER_EXTERNAL_URL) {
    allowedOrigins.push(process.env.RENDER_EXTERNAL_URL);
}

// Add Vercel URL automatically if in production
if (process.env.NODE_ENV === 'production' && process.env.VERCEL_URL) {
    allowedOrigins.push(`https://${process.env.VERCEL_URL}`);
}
if (process.env.NODE_ENV === 'production' && process.env.VERCEL) {
    // Allow Vercel preview and production URLs
    if (process.env.VERCEL_URL) {
        allowedOrigins.push(`https://${process.env.VERCEL_URL}`);
    }
    // Production domain (if set via Vercel environment variable)
    if (process.env.PRODUCTION_URL) {
        allowedOrigins.push(process.env.PRODUCTION_URL);
    }
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
    rolling: true, // Reset expiration on every request to keep session alive
    name: 'kaimaku.sid', // Custom session name
    cookie: { 
        secure: process.env.NODE_ENV === 'production', // HTTPS in production (Render/Vercel use HTTPS)
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: process.env.VERCEL ? 'none' : 'lax', // 'none' for Vercel (cross-domain), 'lax' for same-domain
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

// Apply session middleware
const sessionMiddleware = session(sessionConfig);
app.use(sessionMiddleware);

// Session debugging middleware (log session info for auth endpoints)
app.use((req, res, next) => {
    // Only log for auth-related endpoints to avoid spam
    if (req.path.startsWith('/api/login') || req.path.startsWith('/api/register') || 
        req.path.startsWith('/api/me') || (req.path.startsWith('/api/ratings') && req.method === 'POST')) {
        console.log(`[${req.method} ${req.path}] Session:`, {
            sessionId: req.sessionID ? req.sessionID.substring(0, 10) + '...' : 'none',
            userId: req.session.userId || 'none',
            cookiePresent: req.headers.cookie ? 'yes' : 'no'
        });
    }
    next();
});

// Test endpoint to check API connectivity
app.get('/api/test-animethemes', async (req, res) => {
    try {
        const https = require('https');
        const zlib = require('zlib');
        
        const testUrl = 'https://api.animethemes.moe/anime?page[size]=1';
        const parsedUrl = new URL(testUrl);
        
        const options = {
            hostname: parsedUrl.hostname,
            path: parsedUrl.pathname + parsedUrl.search,
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (compatible; Kaimaku/1.0)'
            },
            timeout: 10000
        };
        
        const response = await new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
                let stream = res;
                const encoding = res.headers['content-encoding'];
                
                if (encoding === 'gzip') {
                    stream = res.pipe(zlib.createGunzip());
                } else if (encoding === 'deflate') {
                    stream = res.pipe(zlib.createInflate());
                }
                
                let data = '';
                stream.on('data', (chunk) => data += chunk.toString());
                stream.on('end', () => resolve({ status: res.statusCode, data, headers: res.headers }));
                stream.on('error', reject);
            });
            
            req.on('error', reject);
            req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
            req.setTimeout(options.timeout);
            req.end();
        });
        
        res.json({
            success: response.status === 200,
            status: response.status,
            headers: response.headers,
            dataLength: response.data ? response.data.length : 0,
            sampleData: response.data ? response.data.substring(0, 200) : null
        });
    } catch (error) {
        res.status(500).json({ error: error.message, stack: error.stack });
    }
});

// API Proxy endpoint to avoid CORS issues
app.get('/api/proxy/animethemes/*', async (req, res) => {
    try {
        // Get the path after /api/proxy/animethemes/
        const apiPath = req.path.replace('/api/proxy/animethemes', '');
        const queryString = req.url.split('?')[1] || '';
        const fullUrl = `https://api.animethemes.moe${apiPath}${queryString ? '?' + queryString : ''}`;
        
        console.log(`[Proxy] Requesting: ${fullUrl}`);
        
        // Use Node.js built-in http/https modules
        const https = require('https');
        const http = require('http');
        const url = require('url');
        
        const parsedUrl = new URL(fullUrl);
        
        // Use minimal headers - API docs say headers are not required
        const options = {
            hostname: parsedUrl.hostname,
            path: parsedUrl.pathname + parsedUrl.search,
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (compatible; Kaimaku/1.0; +https://github.com/potverse-hub/kaimaku)'
            },
            timeout: 30000 // 30 second timeout
        };
        
        const requestModule = parsedUrl.protocol === 'https:' ? https : http;
        const zlib = require('zlib');
        
        const proxyResponse = await new Promise((resolve, reject) => {
            const req = requestModule.request(options, (res) => {
                // Collect response headers for debugging
                const responseHeaders = res.headers;
                const statusCode = res.statusCode;
                
                // Handle different content encodings
                let stream = res;
                const encoding = res.headers['content-encoding'];
                
                if (encoding === 'gzip') {
                    stream = res.pipe(zlib.createGunzip());
                } else if (encoding === 'deflate') {
                    stream = res.pipe(zlib.createInflate());
                } else if (encoding === 'br') {
                    stream = res.pipe(zlib.createBrotliDecompress());
                }
                
                let data = '';
                
                stream.on('data', (chunk) => {
                    data += chunk.toString();
                });
                
                stream.on('end', () => {
                    resolve({ 
                        status: statusCode, 
                        data: data,
                        headers: responseHeaders
                    });
                });
                
                stream.on('error', (error) => {
                    console.error('[Proxy] Stream error:', error);
                    reject(error);
                });
            });
            
            req.on('error', (error) => {
                console.error('[Proxy] Request error:', error);
                reject(error);
            });
            
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });
            
            req.setTimeout(options.timeout);
            req.end();
        });
        
        // Log response for debugging
        console.log(`[Proxy] Response status: ${proxyResponse.status} for ${apiPath}`);
        
        // Forward response headers (especially CORS headers)
        if (proxyResponse.headers['access-control-allow-origin']) {
            res.setHeader('Access-Control-Allow-Origin', proxyResponse.headers['access-control-allow-origin']);
        }
        if (proxyResponse.headers['access-control-allow-methods']) {
            res.setHeader('Access-Control-Allow-Methods', proxyResponse.headers['access-control-allow-methods']);
        }
        if (proxyResponse.headers['access-control-allow-headers']) {
            res.setHeader('Access-Control-Allow-Headers', proxyResponse.headers['access-control-allow-headers']);
        }
        
        // Set CORS headers for our domain
        res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        
        // Handle non-200 status codes
        if (proxyResponse.status !== 200) {
            console.error(`[Proxy] API returned ${proxyResponse.status} for ${fullUrl}`);
            console.error(`[Proxy] Response data:`, proxyResponse.data.substring(0, 500));
            
            // Try to parse error response
            let errorData = { error: `API returned ${proxyResponse.status}` };
            try {
                if (proxyResponse.data) {
                    errorData = JSON.parse(proxyResponse.data);
                }
            } catch (e) {
                // Not JSON, use text
                errorData.message = proxyResponse.data.substring(0, 200);
            }
            
            return res.status(proxyResponse.status).json(errorData);
        }
        
        // Parse and return successful response
        try {
            const data = JSON.parse(proxyResponse.data);
            res.json(data);
        } catch (parseError) {
            console.error('[Proxy] JSON parse error:', parseError);
            console.error('[Proxy] Response data:', proxyResponse.data.substring(0, 500));
            res.status(500).json({ error: 'Invalid JSON response from API', message: parseError.message });
        }
    } catch (error) {
        console.error('[Proxy] Proxy error:', error);
        res.status(500).json({ error: 'Failed to proxy request', message: error.message });
    }
});

// Serve static files (HTML, CSS, JS)
// On Vercel, static files are served automatically from the root directory
// On traditional servers, we serve them via Express
if (!process.env.VERCEL) {
    app.use(express.static(__dirname));
} else {
    // On Vercel, serve index.html for root and other routes
    const path = require('path');
    app.get('/', (req, res) => {
        res.sendFile(path.join(__dirname, 'index.html'));
    });
}

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
        
        // Log cookie settings for debugging
        console.log('Login - Setting session cookie:', {
            secure: sessionConfig.cookie.secure,
            sameSite: sessionConfig.cookie.sameSite,
            httpOnly: sessionConfig.cookie.httpOnly,
            maxAge: sessionConfig.cookie.maxAge,
            sessionId: req.sessionID
        });
        
        // Save session explicitly to ensure it's persisted
        req.session.save((err) => {
            if (err) {
                console.error('Error saving session:', err);
                return res.status(500).json({ error: 'Failed to save session' });
            }
            
            // Log response headers to verify cookie is being set
            const setCookieHeader = res.getHeader('Set-Cookie');
            console.log('Login - Response Set-Cookie header:', setCookieHeader ? 'present' : 'missing');
            if (setCookieHeader) {
                const cookieStr = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader;
                console.log('Login - Cookie value:', cookieStr.substring(0, 100) + '...');
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

// Get all ratings (public aggregated ratings)
app.get('/api/ratings', async (req, res) => {
    try {
        const data = await db.getRatings();
        res.json(data);
    } catch (error) {
        console.error('Error reading ratings:', error);
        res.status(500).json({ error: 'Failed to read ratings' });
    }
});

// Get current user's personal ratings (requires authentication)
app.get('/api/my-ratings', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        
        const userId = req.session.userId;
        const userRatings = await db.getUserRatings(userId);
        res.json({ ratings: userRatings });
    } catch (error) {
        console.error('Error reading user ratings:', error);
        res.status(500).json({ error: 'Failed to read user ratings' });
    }
});

// Save a rating (requires authentication)
app.post('/api/ratings', async (req, res) => {
    try {
        // Log session info for debugging
        console.log(`[POST /api/ratings] Session check:`, {
            sessionId: req.sessionID ? req.sessionID.substring(0, 10) + '...' : 'none',
            userId: req.session.userId || 'none',
            cookiePresent: req.headers.cookie ? 'yes' : 'no'
        });
        
        if (!req.session.userId) {
            console.warn(`[POST /api/ratings] Authentication failed: No userId in session`);
            return res.status(401).json({ error: 'Authentication required' });
        }
        
        const { themeId, rating, metadata } = req.body;
        const userId = req.session.userId;
        
        if (!themeId || rating === undefined) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        // Touch the session to keep it alive before database operation
        req.session.touch();
        
        const themeRating = await db.saveRating(themeId, userId, rating, metadata);
        
        // Verify session is still valid after database operation
        if (!req.session.userId) {
            console.error(`[POST /api/ratings] Session lost during database operation!`);
            return res.status(401).json({ error: 'Session expired during operation' });
        }
        
        // Touch session again to ensure it's saved
        req.session.touch();
        
        // Send response - express-session will auto-save the session
        res.json({ success: true, themeRating });
    } catch (error) {
        console.error('Error saving rating:', error);
        res.status(500).json({ error: 'Failed to save rating' });
    }
});

// Always export the app (for Vercel serverless functions)
// This allows the app to be imported by api/index.js on Vercel
module.exports = app;

// Start server only if not running on Vercel
// Vercel uses serverless functions and doesn't need a listening server
if (!process.env.VERCEL) {
    // Traditional server (Render, local development, etc.)
    // Start server immediately, initialize database in background
    // This ensures Render detects the port quickly
    const server = app.listen(PORT, '0.0.0.0', () => {
        console.log(`\n✅ Server running on port ${PORT}`);
        console.log(`🌐 Server is ready to accept connections\n`);
        console.log(`📊 Session store: ${sessionConfig.store ? 'PostgreSQL' : 'MemoryStore'}\n`);
        
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
} else {
    // Vercel serverless function - initialize database on cold start
    // Note: This runs on cold start, connection pooling is handled by pg
    // Database initialization is non-blocking for serverless functions
    initializeDatabaseInBackground().catch(err => {
        console.error('Database initialization error (non-blocking):', err.message);
    });
}

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
