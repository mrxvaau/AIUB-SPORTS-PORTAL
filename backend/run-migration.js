const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
    connectionString: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
    ssl: false // Local postgres usually doesn't need SSL or different config
});

const fs = require('fs');
const path = require('path');

async function migrate() {
    try {
        await client.connect();
        console.log('Connected to database');

        const sqlPath = path.join(__dirname, 'migrations', 'fix_payments_user_id.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Executing migration from:', sqlPath);
        await client.query(sql);

        console.log('Migration completed successfully.');

    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await client.end();
    }
}

migrate();
