const { supabase } = require('./config/supabase');

async function debugData() {
    try {
        console.log('--- Debugging Schema: Payments ---');

        // Check if payments table exists and get its info
        const { data: columns, error: colError } = await supabase
            .from('payments')
            .select('*')
            .limit(1);

        if (colError) {
            console.log('Error accessing payments table:', colError.message);
            // If table doesn't exist, we know we need to create it properly
        } else {
            console.log('Payments table exists. Sample row:', columns[0]);
        }

        // We can't easily check column types via JS client without admin rights or rpc, 
        // but we can try to insert a dummy record with an integer user_id and see if it fails.

        const { data: user } = await supabase.from('users').select('id').limit(1).single();
        if (user) {
            console.log('Testing insert with User ID (INT):', user.id);
            const { error: insertError } = await supabase
                .from('payments')
                .insert({
                    user_id: user.id, // ID is BIGINT
                    amount: 100,
                    payment_method: 'bkash',
                    transaction_id: 'DEBUG_' + Date.now(),
                    payment_status: 'PENDING'
                });

            if (insertError) {
                console.log('Insert failed (likely type mismatch):', insertError.message);
            } else {
                console.log('Insert successful! Schema seems compatible.');
            }
        }

    } catch (e) {
        console.error('Debug script error:', e);
    }
}

debugData();
