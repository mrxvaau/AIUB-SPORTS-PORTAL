/**
 * Supabase Client — AIUB Office of Sports
 * Shared initialization used by both frontend/index.html and admin-dashboard.html
 *
 * SECURITY: Credentials are NOT hardcoded here.
 * They are injected at runtime via window.SUPABASE_CONFIG set by the backend
 * or via <meta> tags. Never commit real keys into source files.
 */

// Create the Supabase client and expose it globally as `window.db`
(function () {
    if (typeof supabase === 'undefined') {
        console.error('[supabase-client] Supabase JS library not loaded. Make sure the CDN script is included before this file.');
        return;
    }

    // Resolution order:
    // 1. window.SUPABASE_CONFIG (injected by backend/CDN)
    // 2. <meta name="supabase-url"> / <meta name="supabase-anon-key"> tags
    var supabaseUrl = null;
    var supabaseAnonKey = null;

    if (window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.url && window.SUPABASE_CONFIG.anonKey) {
        supabaseUrl    = window.SUPABASE_CONFIG.url;
        supabaseAnonKey = window.SUPABASE_CONFIG.anonKey;
    } else {
        var urlMeta  = document.querySelector('meta[name="supabase-url"]');
        var keyMeta  = document.querySelector('meta[name="supabase-anon-key"]');
        if (urlMeta)  supabaseUrl    = urlMeta.getAttribute('content');
        if (keyMeta)  supabaseAnonKey = keyMeta.getAttribute('content');
    }

    if (!supabaseUrl || !supabaseAnonKey) {
        console.error('[supabase-client] Supabase credentials not configured. Set window.SUPABASE_CONFIG or add <meta name="supabase-url"> / <meta name="supabase-anon-key"> to the page.');
        return;
    }

    window.db = supabase.createClient(supabaseUrl, supabaseAnonKey);
    console.log('[supabase-client] Supabase client initialized.');
})();
