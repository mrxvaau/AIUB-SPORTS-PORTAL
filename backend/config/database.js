// Oracle Database Configuration
// Version 1.0

const oracledb = require('oracledb');
require('dotenv').config();

// Force Thick mode for Oracle 10g compatibility
oracledb.initOracleClient({ libDir: 'C:\\oraclexe\\instantclient_23_9' });

// Oracle configuration
const dbConfig = {
    user: process.env.DB_USER || 'system',
    password: process.env.DB_PASSWORD || 'oracle',
    connectString: process.env.DB_CONNECTION_STRING || 'localhost:1521/XE'
};

// Connection pool configuration
const poolConfig = {
    user: dbConfig.user,
    password: dbConfig.password,
    connectString: dbConfig.connectString,
    poolMin: 2,
    poolMax: 10,
    poolIncrement: 2,
    poolTimeout: 60
};

let pool;

// Initialize connection pool
async function initialize() {
    try {
        console.log('🔌 Connecting to Oracle Database...');
        pool = await oracledb.createPool(poolConfig);
        console.log('✅ Oracle Database connection pool created');
        
        // Test connection
        const connection = await pool.getConnection();
        const result = await connection.execute('SELECT * FROM v$version');
        console.log('✅ Database version:', result.rows[0][0]);
        await connection.close();
        
        return pool;
    } catch (err) {
        console.error('❌ Error creating connection pool:', err);
        throw err;
    }
}

// Get a connection from pool
async function getConnection() {
    try {
        if (!pool) {
            await initialize();
        }
        return await pool.getConnection();
    } catch (err) {
        console.error('Error getting connection:', err);
        throw err;
    }
}

// Close connection pool
async function close() {
    try {
        if (pool) {
            await pool.close(10);
            console.log('🔌 Connection pool closed');
        }
    } catch (err) {
        console.error('Error closing pool:', err);
        throw err;
    }
}

// Execute query helper
async function executeQuery(sql, params = [], options = {}) {
    let connection;
    try {
        connection = await getConnection();

        // Determine if params is for simple queries or complex PL/SQL binding
        let bindParams;
        if (Array.isArray(params)) {
            // Simple array of values for regular queries
            bindParams = params;
        } else if (params && typeof params === 'object') {
            // Check if this is a complex bind parameter object (has binding properties)
            const isComplexBind = Object.values(params).some(param =>
                (typeof param === 'object' && param !== null &&
                 (param.hasOwnProperty('val') || param.hasOwnProperty('dir') || param.hasOwnProperty('type') || param.hasOwnProperty('maxSize')))
            );

            if (isComplexBind) {
                // This is a complex bind parameter object for PL/SQL blocks
                bindParams = params;
            } else {
                // This is a regular object to be passed as-is
                bindParams = params;
            }
        } else {
            // Single value
            bindParams = [params];
        }

        const result = await connection.execute(sql, bindParams, {
            outFormat: oracledb.OUT_FORMAT_OBJECT,
            autoCommit: true,
            ...options
        });
        return result;
    } catch (err) {
        console.error('Database query error:', err);
        throw err;
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error('Error closing connection:', err);
            }
        }
    }
}

// Call stored procedure helper - FIXED VERSION
async function callProcedure(procedureName, params) {
    let connection;
    try {
        connection = await getConnection();
        
        // Build the PL/SQL block
        const plsql = `BEGIN ${procedureName}; END;`;
        
        const result = await connection.execute(plsql, params, { 
            autoCommit: true 
        });
        
        return result;
    } catch (err) {
        console.error('Procedure call error:', err);
        throw err;
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error('Error closing connection:', err);
            }
        }
    }
}

// Initialize on startup
initialize().catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n⚠️  Shutting down gracefully...');
    await close();
    process.exit(0);
});

module.exports = {
    initialize,
    getConnection,
    close,
    executeQuery,
    callProcedure
};