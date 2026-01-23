# Database Setup

## Instructions for Supabase (PostgreSQL)

1. Create a Supabase project at https://supabase.com
2. Copy your project URL and API keys
3. Run the schema using the SQL Editor in your Supabase dashboard:
   - Navigate to SQL Editor
   - Paste the contents of `supabase_schema.sql`
   - Execute the script

## Alternative: Local PostgreSQL Setup

1. Connect to PostgreSQL: `psql -U username -d database_name`
2. Run schema: `\i supabase_schema.sql`
3. Verify: `SELECT * FROM users;`
