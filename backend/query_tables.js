const { Client } = require('pg');
require('dotenv').config();

// SECURITY: Never hardcode credentials. Load from environment variables.
const pgPassword = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
if (!pgPassword) {
  console.error('\u274c FATAL: No Supabase key found in environment variables for pg connection.');
  process.exit(1);
}

const client = new Client({
  host: process.env.SUPABASE_PG_HOST || 'aws-0-ap-southeast-1.pooler.supabase.com',
  port: parseInt(process.env.SUPABASE_PG_PORT || '6543'),
  database: process.env.SUPABASE_PG_DB || 'postgres',
  user: process.env.SUPABASE_PG_USER || 'postgres',
  password: pgPassword,
  ssl: { rejectUnauthorized: false }
});

async function runQuery() {
  try {
    console.log('Connecting to Supabase...');
    await client.connect();
    console.log('Connected to Supabase!\n');
    
    const result = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;");
    
    console.log('=== Tables in public schema ===\n');
    result.rows.forEach((row, i) => {
      console.log((i+1) + '. ' + row.table_name);
    });
    console.log('\nTotal: ' + result.rows.length + ' tables\n');
    
    await client.end();
    console.log('Connection closed.');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

runQuery();
