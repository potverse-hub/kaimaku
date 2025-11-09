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
    // Also add HTTPS version if HTTP was provided, and vice versa
    const renderUrl = process.env.RENDER_EXTERNAL_URL;
    if (renderUrl.startsWith('http://')) {
        allowedOrigins.push(renderUrl.replace('http://', 'https://'));
    } else if (renderUrl.startsWith('https://')) {
        allowedOrigins.push(renderUrl.replace('https://', 'http://'));
    }
}

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (mobile apps, curl, etc.) - important for mobile browsers
        if (!origin) {
            console.log('[CORS] Request with no origin header (mobile/app/curl) - allowing');
            return callback(null, true);
        }
        
        // In production, check against allowed origins
        if (process.env.NODE_ENV === 'production') {
            // Check exact match first
            if (allowedOrigins.indexOf(origin) !== -1) {
                callback(null, true);
                return;
            }
            
            // Check if origin matches any allowed origin (for subdomains, etc.)
            const originMatches = allowedOrigins.some(allowed => {
                try {
                    const allowedUrl = new URL(allowed);
                    const originUrl = new URL(origin);
                    // Match if same hostname (allows for http/https variations)
                    return allowedUrl.hostname === originUrl.hostname;
                } catch (e) {
                    return false;
                }
            });
            
            if (originMatches) {
                console.log(`[CORS] Origin ${origin} matched allowed origin pattern - allowing`);
                callback(null, true);
            } else {
                console.warn(`[CORS] Blocked origin: ${origin}. Allowed: ${allowedOrigins.join(', ')}`);
                // Still allow it but log a warning - this helps with mobile browser variations
                callback(null, true);
            }
        } else {
            // In development, allow all origins
            callback(null, true);
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept', 'Authorization']
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
        secure: process.env.NODE_ENV === 'production', // HTTPS in production (Render uses HTTPS)
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: 'lax', // 'lax' works for same-site requests (frontend and backend on same domain)
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

// Handle OPTIONS requests for CORS preflight (important for mobile browsers)
app.options('/api/proxy/animethemes/*', (req, res) => {
    const requestOrigin = req.headers.origin;
    if (requestOrigin) {
        res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    } else {
        res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.sendStatus(204);
});

// API Proxy endpoint to avoid CORS issues
app.get('/api/proxy/animethemes/*', async (req, res) => {
    // Set CORS headers first (before any processing)
    const requestOrigin = req.headers.origin;
    if (requestOrigin) {
        res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    } else {
        res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400');
    
    try {
        // Get the path after /api/proxy/animethemes/
        const apiPath = req.path.replace('/api/proxy/animethemes', '');
        const queryString = req.url.split('?')[1] || '';
        const fullUrl = `https://api.animethemes.moe${apiPath}${queryString ? '?' + queryString : ''}`;
        
        console.log(`[Proxy] Requesting: ${fullUrl}`);
        console.log(`[Proxy] User-Agent: ${req.headers['user-agent'] ? req.headers['user-agent'].substring(0, 50) : 'none'}`);
        
        // Use axios for better Cloudflare handling
        const axios = require('axios');
        
        // Forward client's User-Agent and other browser headers to make request look legitimate
        // This is crucial for bypassing Cloudflare bot detection
        const userAgent = req.headers['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
        const acceptLanguage = req.headers['accept-language'] || 'en-US,en;q=0.9';
        
        const axiosResponse = await axios.get(fullUrl, {
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': acceptLanguage,
                'Accept-Encoding': 'gzip, deflate, br',
                'User-Agent': userAgent,
                'Referer': 'https://api.animethemes.moe/',
                'Origin': 'https://api.animethemes.moe',
                'Connection': 'keep-alive',
                'Sec-Fetch-Dest': 'empty',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Site': 'same-origin',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                'DNT': '1',
                'Upgrade-Insecure-Requests': '1'
            },
            timeout: 30000,
            maxRedirects: 0, // Don't follow redirects (Cloudflare might redirect to challenge pages)
            validateStatus: function (status) {
                // Don't throw on any status - we'll handle it ourselves
                return status >= 200 && status < 600;
            },
            decompress: true // Automatically handle gzip/deflate/brotli
        });
        
        // Log response for debugging
        console.log(`[Proxy] Response status: ${axiosResponse.status} for ${apiPath}`);
        
        // Check if we got a Cloudflare challenge page
        if (axiosResponse.status === 403 || axiosResponse.status === 503) {
            const responseText = typeof axiosResponse.data === 'string' ? axiosResponse.data : JSON.stringify(axiosResponse.data);
            if (responseText.includes('Just a moment') || responseText.includes('cf-browser-verification') || responseText.includes('challenge-platform')) {
                console.error(`[Proxy] Cloudflare challenge detected! Status: ${axiosResponse.status}`);
                console.error(`[Proxy] Response preview: ${responseText.substring(0, 200)}`);
                
                // Return a helpful error message
                return res.status(503).json({ 
                    error: 'Cloudflare protection',
                    message: 'The API is protected by Cloudflare and is blocking server requests. Please contact the API maintainers to whitelist your server IP, or use a different hosting provider.',
                    details: 'This is a known issue with Cloudflare-protected APIs. The API maintainers need to whitelist Render.com IP addresses or adjust Cloudflare settings.'
                });
            }
        }
        
        // Handle non-200 status codes
        if (axiosResponse.status !== 200) {
            console.error(`[Proxy] API returned ${axiosResponse.status} for ${fullUrl}`);
            const responseText = typeof axiosResponse.data === 'string' ? axiosResponse.data : JSON.stringify(axiosResponse.data);
            console.error(`[Proxy] Response data:`, responseText.substring(0, 500));
            
            // Try to parse as JSON error
            let errorData = { error: `API returned ${axiosResponse.status}` };
            try {
                if (typeof axiosResponse.data === 'object') {
                    errorData = axiosResponse.data;
                } else {
                    errorData = JSON.parse(responseText);
                }
            } catch (e) {
                // Not JSON, use text
                errorData.message = responseText.substring(0, 200);
            }
            
            return res.status(axiosResponse.status).json(errorData);
        }
        
        // Return successful response
        res.json(axiosResponse.data);
        
    } catch (error) {
        console.error('[Proxy] Proxy error:', error.message);
        console.error('[Proxy] Error stack:', error.stack);
        
        // Check if it's an axios error
        if (error.response) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx
            console.error(`[Proxy] Axios error response: ${error.response.status}`);
            console.error(`[Proxy] Response data:`, error.response.data ? (typeof error.response.data === 'string' ? error.response.data.substring(0, 200) : JSON.stringify(error.response.data).substring(0, 200)) : 'no data');
            
            // Check for Cloudflare challenge
            const responseText = typeof error.response.data === 'string' ? error.response.data : JSON.stringify(error.response.data || '');
            if (responseText.includes('Just a moment') || responseText.includes('cf-browser-verification')) {
                return res.status(503).json({ 
                    error: 'Cloudflare protection',
                    message: 'The API is protected by Cloudflare and is blocking server requests. Please contact the API maintainers to whitelist your server IP.',
                    details: 'Cloudflare is blocking requests from Render.com. Contact animethemes.moe maintainers to whitelist your IP.'
                });
            }
            
            return res.status(error.response.status).json({ 
                error: 'API request failed', 
                message: error.message,
                status: error.response.status
            });
        } else if (error.request) {
            // The request was made but no response was received
            console.error('[Proxy] No response received:', error.request);
            return res.status(504).json({ 
                error: 'API timeout', 
                message: 'The API did not respond in time. This might be a network issue or the API might be down.'
            });
        } else {
            // Something happened in setting up the request that triggered an Error
            return res.status(500).json({ 
                error: 'Proxy error', 
                message: error.message 
            });
        }
    }
});

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
