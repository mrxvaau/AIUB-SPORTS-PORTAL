// Supabase Configuration
// Version 1.0

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Create Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase configuration in environment variables');
  console.error('Please set SUPABASE_URL and SUPABASE_ANON_KEY in your .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

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