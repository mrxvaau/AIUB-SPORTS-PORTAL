const { Client } = require('pg');

const client = new Client({
  host: 'aws-0-ap-southeast-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres',
  password: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2dHBjd2xnZHdjd3pxYWF5Y29nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTYzNzAwMywiZXhwIjoyMDgxMjEzMDAzfQ.3HBprdXa7U0gma0bq65ZbJVNbOTjODdDNsKduNxttjU',
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
