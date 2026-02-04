// Supabase Configuration
// Version 2.0 - Using Service Role Key for backend operations

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Create Supabase client
const supabaseUrl = process.env.SUPABASE_URL;

// For backend operations, use SERVICE_ROLE_KEY (bypasses RLS)
// This is the recommended approach for server-side code
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  console.error('❌ Missing SUPABASE_URL in environment variables');
  process.exit(1);
}

if (!supabaseKey) {
  console.error('❌ Missing Supabase key in environment variables');
  console.error('Please set SUPABASE_SERVICE_ROLE_KEY (recommended) or SUPABASE_ANON_KEY in your .env file');
  process.exit(1);
}

// Log which key type is being used
if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log('🔐 Using SUPABASE_SERVICE_ROLE_KEY (bypasses RLS - production ready)');
} else {
  console.warn('⚠️  Using SUPABASE_ANON_KEY - RLS policies will apply!');
  console.warn('   For production, add SUPABASE_SERVICE_ROLE_KEY to your .env file');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize Supabase connection
async function initialize() {
  try {
    console.log('🔌 Connecting to Supabase...');

    // Test connection by making a simple request
    const { data, error } = await supabase.from('users').select('id').limit(1);

    if (error) {
      console.error('❌ Error connecting to Supabase:', error.message);
      throw error;
    }

    console.log('✅ Supabase connection established');
    return supabase;
  } catch (err) {
    console.error('❌ Error initializing Supabase:', err);
    throw err;
  }
}

// Export the supabase client and initialization function
module.exports = {
  supabase,
  initialize
};