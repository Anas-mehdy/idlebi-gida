-- Migration: Customer Devices Approval & Price Visibility System

ALTER TABLE customers ADD COLUMN IF NOT EXISTS pin_hash TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS max_devices INTEGER DEFAULT 2 NOT NULL;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS show_prices BOOLEAN DEFAULT TRUE NOT NULL;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended'));

CREATE TABLE IF NOT EXISTS customer_access_links (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    last_used_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    revoked_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS customer_devices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    device_token_hash TEXT NOT NULL UNIQUE,
    fingerprint_hash TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'blocked', 'revoked')),
    device_name TEXT,
    browser TEXT,
    operating_system TEXT,
    user_agent TEXT,
    first_ip TEXT,
    last_ip TEXT,
    first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    approved_at TIMESTAMP WITH TIME ZONE,
    rejected_at TIMESTAMP WITH TIME ZONE,
    blocked_at TIMESTAMP WITH TIME ZONE,
    revoked_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS customer_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    device_id UUID NOT NULL REFERENCES customer_devices(id) ON DELETE CASCADE,
    session_token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    revoked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS security_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    device_id UUID REFERENCES customer_devices(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    ip TEXT,
    user_agent TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE customer_access_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow admin all customer_access_links" ON customer_access_links;
CREATE POLICY "Allow admin all customer_access_links" ON customer_access_links FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow admin all customer_devices" ON customer_devices;
CREATE POLICY "Allow admin all customer_devices" ON customer_devices FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow admin all customer_sessions" ON customer_sessions;
CREATE POLICY "Allow admin all customer_sessions" ON customer_sessions FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow admin all security_events" ON security_events;
CREATE POLICY "Allow admin all security_events" ON security_events FOR ALL TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_customer_access_links_token ON customer_access_links(token_hash);
CREATE INDEX IF NOT EXISTS idx_customer_devices_token ON customer_devices(device_token_hash);
CREATE INDEX IF NOT EXISTS idx_customer_sessions_token ON customer_sessions(session_token_hash);
CREATE INDEX IF NOT EXISTS idx_customer_devices_customer ON customer_devices(customer_id);
