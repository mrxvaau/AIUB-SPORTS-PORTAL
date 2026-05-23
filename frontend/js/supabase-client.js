/**
 * Supabase Client — AIUB Office of Sports
 * Shared initialization used by both frontend/index.html and admin-dashboard.html
 *
 * Project: qvtpcwlgdwcwzqaaycog  (ap-south-1)
 * Updated: 2026-05-20
 */

const SUPABASE_URL  = 'https://qvtpcwlgdwcwzqaaycog.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2dHBjd2xnZHdjd3pxYWF5Y29nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2MzcwMDMsImV4cCI6MjA4MTIxMzAwM30.cE6TTsP4Bq19jGWHOygb7CJfWdLp-Ygcdli0FOU571E';

// Create the Supabase client and expose it globally as `window.db`
(function () {
    if (typeof supabase === 'undefined') {
        console.error('[supabase-client] Supabase JS library not loaded. Make sure the CDN script is included before this file.');
        return;
    }
    window.db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('[supabase-client] Supabase client initialized.');
})();
