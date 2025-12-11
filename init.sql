CREATE TABLE IF NOT EXISTS inventory (
    id SERIAL PRIMARY KEY,
    inventory_name TEXT NOT NULL,
    description TEXT DEFAULT '',
    photo TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- авто апдейт 
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trg_inventory_updated_at'
    ) THEN
        CREATE TRIGGER trg_inventory_updated_at
        BEFORE UPDATE ON inventory
        FOR EACH ROW
        EXECUTE FUNCTION set_updated_at();
    END IF;
END;
$$;


