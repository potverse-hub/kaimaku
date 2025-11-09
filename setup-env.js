// Quick script to help set up .env file with URL-encoded password
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log('Setting up .env file for Supabase...\n');

// Your Supabase details
const host = 'ktaefwoqmaqhzziozfmc.supabase.co';
const password = 'Ryan2005:)##';

// URL encode the password
const encodedPassword = encodeURIComponent(password);

const databaseUrl = `postgresql://postgres:${encodedPassword}@${host}:5432/postgres`;

// Generate a random session secret
const sessionSecret = require('crypto').randomBytes(32).toString('hex');

const envContent = `# Supabase PostgreSQL Connection
DATABASE_URL=${databaseUrl}

# Session secret
SESSION_SECRET=${sessionSecret}

# Environment
NODE_ENV=development

# Allowed CORS origins (for production, add your Render URL)
ALLOWED_ORIGINS=
`;

const fs = require('fs');
fs.writeFileSync('.env', envContent);

console.log('✅ Created .env file!');
console.log('\n📋 Your DATABASE_URL for Render:');
console.log(databaseUrl);
console.log('\n📋 Your SESSION_SECRET for Render:');
console.log(sessionSecret);
console.log('\n💡 You can now:');
console.log('   1. Test locally: npm start');
console.log('   2. Deploy to Render with the DATABASE_URL above');
console.log('\n⚠️  Keep your .env file secret! It\'s already in .gitignore\n');

rl.close();

