-- PostgreSQL init script — runs once on first container start
-- Mirrors the extensions enabled on Railway EU (Amsterdam)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS vector;
