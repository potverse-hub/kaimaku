// PostgreSQL database connection and operations
const { Pool } = require('pg');

// Create connection pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
    connectionTimeoutMillis: 10000, // Return an error after 10 seconds if connection could not be established
    statement_timeout: 10000, // Return an error after 10 seconds if query doesn't complete
    query_timeout: 10000 // Return an error after 10 seconds if query doesn't complete
});

// Test database connection
async function testConnection() {
    try {
        const client = await pool.connect();
        console.log('✅ Database connection successful');
        client.release();
        return true;
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        return false;
    }
}

// Initialize database tables
async function initializeDatabase() {
    try {
        console.log('🔄 Testing database connection...');
        const connected = await testConnection();
        if (!connected) {
            throw new Error('Database connection failed');
        }

        console.log('🔄 Creating database tables...');

        // Create users table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                username VARCHAR(255) PRIMARY KEY,
                password_hash VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create ratings table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS ratings (
                id SERIAL PRIMARY KEY,
                theme_id VARCHAR(255) NOT NULL,
                user_id VARCHAR(255) NOT NULL REFERENCES users(username) ON DELETE CASCADE,
                rating DECIMAL(3,1) NOT NULL CHECK (rating >= 0 AND rating <= 10),
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                anime_name VARCHAR(500),
                anime_slug VARCHAR(500),
                theme_sequence INTEGER,
                UNIQUE(theme_id, user_id)
            )
        `);

        // Create index on theme_id for faster lookups
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_ratings_theme_id ON ratings(theme_id)
        `);

        // Create index on user_id for faster lookups
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_ratings_user_id ON ratings(user_id)
        `);

        // Create user_sessions table (for connect-pg-simple)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_sessions (
                sid VARCHAR NOT NULL COLLATE "default",
                sess JSON NOT NULL,
                expire TIMESTAMP(6) NOT NULL
            )
            WITH (OIDS=FALSE)
        `);

        // Create index on sid
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_user_sessions_sid ON user_sessions(sid)
        `);

        // Create index on expire for automatic cleanup
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_user_sessions_expire ON user_sessions(expire)
        `);

        console.log('✅ Database tables created successfully');
        return true;
    } catch (error) {
        console.error('❌ Error initializing database:', error);
        throw error;
    }
}

// Get user by username
async function getUser(username) {
    try {
        const result = await pool.query(
            'SELECT username, password_hash FROM users WHERE username = $1',
            [username]
        );
        return result.rows[0] || null;
    } catch (error) {
        console.error('Error getting user:', error);
        throw error;
    }
}

// Create new user
async function createUser(username, passwordHash) {
    try {
        await pool.query(
            'INSERT INTO users (username, password_hash) VALUES ($1, $2)',
            [username, passwordHash]
        );
        return { username, password_hash: passwordHash };
    } catch (error) {
        console.error('Error creating user:', error);
        throw error;
    }
}

// Get all ratings (aggregated by theme_id)
async function getRatings() {
    try {
        const result = await pool.query(`
            SELECT 
                theme_id,
                COUNT(*) as rating_count,
                AVG(rating) as average_rating,
                MIN(rating) as min_rating,
                MAX(rating) as max_rating
            FROM ratings
            GROUP BY theme_id
        `);

        const ratings = {};
        result.rows.forEach(row => {
            ratings[row.theme_id] = {
                count: parseInt(row.rating_count),
                average: parseFloat(row.average_rating),
                min: parseFloat(row.min_rating),
                max: parseFloat(row.max_rating)
            };
        });

        return ratings;
    } catch (error) {
        console.error('Error getting ratings:', error);
        throw error;
    }
}

// Get user-specific ratings
async function getUserRatings(userId) {
    try {
        const result = await pool.query(
            'SELECT theme_id, rating, timestamp, anime_name, anime_slug, theme_sequence FROM ratings WHERE user_id = $1',
            [userId]
        );

        const ratings = {};
        result.rows.forEach(row => {
            ratings[row.theme_id] = {
                rating: parseFloat(row.rating),
                timestamp: row.timestamp,
                animeName: row.anime_name,
                animeSlug: row.anime_slug,
                themeSequence: row.theme_sequence
            };
        });

        return ratings;
    } catch (error) {
        console.error('Error getting user ratings:', error);
        throw error;
    }
}

// Save or update a rating
async function saveRating(themeId, userId, rating, metadata = {}) {
    try {
        // Insert or update rating (upsert)
        const result = await pool.query(`
            INSERT INTO ratings (theme_id, user_id, rating, anime_name, anime_slug, theme_sequence)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (theme_id, user_id)
            DO UPDATE SET 
                rating = EXCLUDED.rating,
                timestamp = CURRENT_TIMESTAMP,
                anime_name = EXCLUDED.anime_name,
                anime_slug = EXCLUDED.anime_slug,
                theme_sequence = EXCLUDED.theme_sequence
            RETURNING *
        `, [
            themeId,
            userId,
            rating,
            metadata.animeName || null,
            metadata.animeSlug || null,
            metadata.themeSequence || null
        ]);

        // Get aggregated rating for this theme
        const aggregatedResult = await pool.query(`
            SELECT 
                COUNT(*) as rating_count,
                AVG(rating) as average_rating
            FROM ratings
            WHERE theme_id = $1
        `, [themeId]);

        const aggregated = aggregatedResult.rows[0];
        return {
            themeId,
            userId,
            rating: parseFloat(result.rows[0].rating),
            timestamp: result.rows[0].timestamp,
            aggregated: {
                count: parseInt(aggregated.rating_count),
                average: parseFloat(aggregated.average_rating)
            }
        };
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
    getUserRatings,
    saveRating,
    testConnection
};

