// PostgreSQL database connection and queries
const { Pool } = require('pg');

// Create connection pool
if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not set!');
    console.error('💡 Please set DATABASE_URL to your PostgreSQL connection string');
    console.error('💡 For Supabase: Get it from Settings → Database → Connection string');
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 20000, // 20 second timeout (increased for Supabase)
    idleTimeoutMillis: 30000,
    max: 10, // Reduced for Supabase connection pooling
    // Supabase connection pooling settings
    statement_timeout: 30000,
    query_timeout: 30000
});

// Test connection
pool.on('error', (err) => {
    console.error('❌ Unexpected database error:', err);
});

pool.on('connect', () => {
    console.log('✅ Connected to PostgreSQL database');
});

// Initialize database tables
async function initializeDatabase() {
    try {
        // Test database connection first
        console.log('🔄 Testing database connection...');
        await pool.query('SELECT NOW()');
        console.log('✅ Database connection successful');
        
        // Create users table
        console.log('🔄 Creating users table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                username VARCHAR(50) PRIMARY KEY,
                password_hash TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create ratings table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS ratings (
                id SERIAL PRIMARY KEY,
                theme_id VARCHAR(255) NOT NULL,
                user_id VARCHAR(50) NOT NULL,
                rating DECIMAL(3,1) NOT NULL CHECK (rating >= 0 AND rating <= 10),
                anime_name VARCHAR(500),
                anime_slug VARCHAR(255),
                theme_sequence INTEGER,
                timestamp BIGINT NOT NULL,
                CONSTRAINT unique_theme_user UNIQUE(theme_id, user_id)
            )
        `);

        // Create index for faster queries
        console.log('🔄 Creating indexes...');
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_ratings_theme_id ON ratings(theme_id)
        `);
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_ratings_user_id ON ratings(user_id)
        `);

        // Note: user_sessions table is created by connect-pg-simple
        // But we can verify it exists
        console.log('🔄 Verifying session table...');
        const sessionTableCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'user_sessions'
            )
        `);
        
        if (sessionTableCheck.rows[0].exists) {
            console.log('✅ Session table exists');
        } else {
            console.log('⚠️  Session table does not exist yet (will be created by connect-pg-simple)');
        }

        console.log('✅ Database tables initialized successfully');
        return true;
    } catch (error) {
        console.error('❌ Error initializing database:', error);
        console.error('Error message:', error.message);
        console.error('Error code:', error.code);
        if (error.message && error.message.includes('connect')) {
            console.error('💡 Check your DATABASE_URL connection string');
            console.error('💡 Make sure your Supabase project is active');
        }
        return false;
    }
}

// User functions
async function getUser(username) {
    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        return result.rows[0] || null;
    } catch (error) {
        console.error('Error getting user:', error);
        throw error;
    }
}

async function createUser(username, passwordHash) {
    try {
        await pool.query(
            'INSERT INTO users (username, password_hash) VALUES ($1, $2) ON CONFLICT (username) DO NOTHING',
            [username, passwordHash]
        );
        return true;
    } catch (error) {
        console.error('Error creating user:', error);
        throw error;
    }
}

// Rating functions
async function getRatings() {
    try {
        // Get all individual ratings
        const ratingsResult = await pool.query('SELECT * FROM ratings');
        const ratings = {};
        ratingsResult.rows.forEach(row => {
            const key = `${row.theme_id}_${row.user_id}`;
            ratings[key] = {
                themeId: row.theme_id,
                rating: parseFloat(row.rating),
                userId: row.user_id,
                timestamp: row.timestamp,
                animeName: row.anime_name,
                animeSlug: row.anime_slug,
                themeSequence: row.theme_sequence
            };
        });

        // Calculate aggregated ratings per theme
        const themeRatingsResult = await pool.query(`
            SELECT 
                theme_id,
                COUNT(*) as count,
                AVG(rating) as average,
                MAX(anime_name) as anime_name,
                MAX(anime_slug) as anime_slug,
                MAX(theme_sequence) as theme_sequence,
                MAX(timestamp) as last_updated
            FROM ratings
            GROUP BY theme_id
        `);

        const themeRatings = {};
        themeRatingsResult.rows.forEach(row => {
            themeRatings[row.theme_id] = {
                themeId: row.theme_id,
                count: parseInt(row.count),
                average: parseFloat(row.average),
                animeName: row.anime_name,
                animeSlug: row.anime_slug,
                themeSequence: row.theme_sequence,
                lastUpdated: row.last_updated
            };
        });

        return {
            ratings,
            themeRatings,
            lastUpdated: Date.now()
        };
    } catch (error) {
        console.error('Error getting ratings:', error);
        throw error;
    }
}

async function saveRating(themeId, userId, rating, metadata) {
    try {
        // Insert or update rating
        await pool.query(`
            INSERT INTO ratings (theme_id, user_id, rating, anime_name, anime_slug, theme_sequence, timestamp)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (theme_id, user_id)
            DO UPDATE SET 
                rating = EXCLUDED.rating,
                timestamp = EXCLUDED.timestamp,
                anime_name = EXCLUDED.anime_name,
                anime_slug = EXCLUDED.anime_slug,
                theme_sequence = EXCLUDED.theme_sequence
        `, [
            themeId,
            userId,
            rating,
            metadata?.animeName || null,
            metadata?.animeSlug || null,
            metadata?.themeSequence || null,
            Date.now()
        ]);

        // Get aggregated rating for this theme
        const result = await pool.query(`
            SELECT 
                theme_id,
                COUNT(*) as count,
                AVG(rating) as average,
                MAX(anime_name) as anime_name,
                MAX(anime_slug) as anime_slug,
                MAX(theme_sequence) as theme_sequence,
                MAX(timestamp) as last_updated
            FROM ratings
            WHERE theme_id = $1
            GROUP BY theme_id
        `, [themeId]);

        if (result.rows.length > 0) {
            const row = result.rows[0];
            return {
                themeId: row.theme_id,
                count: parseInt(row.count),
                average: parseFloat(row.average),
                animeName: row.anime_name,
                animeSlug: row.anime_slug,
                themeSequence: row.theme_sequence,
                lastUpdated: row.last_updated
            };
        }

        return null;
    } catch (error) {
        console.error('Error saving rating:', error);
        throw error;
    }
}

module.exports = {
    pool,
    initializeDatabase,
    getUser,
    createUser,
    getRatings,
    saveRating
};

