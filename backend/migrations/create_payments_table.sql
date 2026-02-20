CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id BIGINT REFERENCES users(id),
    order_id TEXT, -- What the payment was for (e.g. cart_id or specialized order id)
    bkash_transaction_id TEXT UNIQUE, -- Most important – unique proof
    bkash_payment_id TEXT, -- Returned by bKash checkout
    amount DECIMAL(10, 2) NOT NULL,
    currency TEXT DEFAULT 'BDT',
    payment_status TEXT CHECK (payment_status IN ('SUCCESS', 'FAILED', 'CANCELLED', 'PENDING')),
    payment_method TEXT DEFAULT 'BKASH',
    merchant_number TEXT,
    invoice_no TEXT,
    payment_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_bkash_trx ON payments(bkash_transaction_id);
