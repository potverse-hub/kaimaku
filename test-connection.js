// Quick test to URL-encode the password correctly
const password = 'Ryan2005:)##';
const encoded = encodeURIComponent(password);
console.log('Original password:', password);
console.log('URL-encoded password:', encoded);
console.log('\nYour connection string should be:');
console.log(`postgresql://postgres:${encoded}@db.ktaefwoqmaqhzziozfmc.supabase.co:5432/postgres`);

