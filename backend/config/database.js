// Database Configuration - Supabase Version
// Version 1.0

const { supabase } = require('./supabase');

// This module provides database utilities for the application
// Since we're using Supabase, we'll provide helper functions that wrap
// common operations on the Supabase client

// Execute query helper
async function executeQuery(sql, params = [], options = {}) {
    try {
        // This function is maintained for compatibility with existing code
        // but will throw an error since we now use Supabase's query methods
        throw new Error('executeQuery is deprecated with Supabase. Use Supabase client methods directly.');
    } catch (err) {
        console.error('Database query error:', err);
        throw err;
    }
}

// Call stored procedure helper - FIXED VERSION
async function callProcedure(procedureName, params) {
    try {
        // This function is maintained for compatibility with existing code
        // but will throw an error since we now use Supabase (PostgreSQL)
        throw new Error('callProcedure is deprecated with Supabase. Use Supabase client methods or PostgreSQL functions directly.');
    } catch (err) {
        console.error('Procedure call error:', err);
        throw err;
    }
}

module.exports = {
    executeQuery,
    callProcedure
};