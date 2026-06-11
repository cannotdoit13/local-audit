-- Locality Audit Database Schema
-- Requires: PostGIS, pgvector extensions

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS vector;

-- Localities (areas/neighbourhoods with polygon boundaries)
CREATE TABLE IF NOT EXISTS localities (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    city VARCHAR(100) NOT NULL DEFAULT 'pune',
    boundary GEOMETRY(Polygon, 4326),
    centroid_lat DOUBLE PRECISION,
    centroid_lng DOUBLE PRECISION,
    safety_score NUMERIC(5,2),
    score_grade VARCHAR(2),  -- A+, A, B+, B, C, D, F
    score_components JSONB DEFAULT '{}',
    population_estimate INTEGER,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_localities_boundary ON localities USING GIST(boundary);
CREATE INDEX idx_localities_slug ON localities(slug);
CREATE INDEX idx_localities_city ON localities(city);

-- Buildings (societies/projects with point locations)
CREATE TABLE IF NOT EXISTS buildings (
    id SERIAL PRIMARY KEY,
    name VARCHAR(500) NOT NULL,
    slug VARCHAR(500) UNIQUE NOT NULL,
    locality_id INTEGER REFERENCES localities(id),
    address TEXT,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    location GEOMETRY(Point, 4326),
    rera_id VARCHAR(100),
    builder_name VARCHAR(255),
    builder_id INTEGER,
    year_built INTEGER,
    total_units INTEGER,
    score NUMERIC(5,2),
    score_grade VARCHAR(2),
    score_components JSONB DEFAULT '{}',
    rera_status VARCHAR(50),  -- registered, completed, lapsed, revoked
    rera_completion_pct NUMERIC(5,2),
    rera_complaints INTEGER DEFAULT 0,
    review_count INTEGER DEFAULT 0,
    avg_review_rating NUMERIC(3,2),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_buildings_location ON buildings USING GIST(location);
CREATE INDEX idx_buildings_locality ON buildings(locality_id);
CREATE INDEX idx_buildings_slug ON buildings(slug);
CREATE INDEX idx_buildings_rera ON buildings(rera_id);
CREATE INDEX idx_buildings_lat_lng ON buildings(latitude, longitude);

-- News incidents (classified, geocoded news articles)
CREATE TABLE IF NOT EXISTS news_incidents (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    summary TEXT,
    body_excerpt TEXT,
    type VARCHAR(50) NOT NULL,  -- crime, civic, infrastructure, legal, safety, positive, other
    severity INTEGER NOT NULL CHECK (severity BETWEEN 1 AND 5),
    locality_id INTEGER REFERENCES localities(id),
    locality_name VARCHAR(255),
    building_id INTEGER REFERENCES buildings(id),
    location GEOMETRY(Point, 4326),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    radius_meters INTEGER DEFAULT 500,
    source_url TEXT NOT NULL,
    source_name VARCHAR(100),
    published_at TIMESTAMP WITH TIME ZONE,
    classified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    embedding vector(1536),
    raw_classification JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_news_location ON news_incidents USING GIST(location);
CREATE INDEX idx_news_locality ON news_incidents(locality_id);
CREATE INDEX idx_news_type ON news_incidents(type);
CREATE INDEX idx_news_published ON news_incidents(published_at DESC);
CREATE INDEX idx_news_severity ON news_incidents(severity);

-- Reviews (from Google Maps, Housing.com, etc.)
CREATE TABLE IF NOT EXISTS reviews (
    id SERIAL PRIMARY KEY,
    building_id INTEGER REFERENCES buildings(id),
    source VARCHAR(50) NOT NULL,  -- google_maps, housing_com, magicbricks, user
    author_name VARCHAR(255),
    rating NUMERIC(3,2),
    text TEXT,
    themes JSONB DEFAULT '[]',  -- [{theme: "water", sentiment: -0.8}, ...]
    sentiment_score NUMERIC(4,3),
    published_at TIMESTAMP WITH TIME ZONE,
    scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_reviews_building ON reviews(building_id);
CREATE INDEX idx_reviews_source ON reviews(source);

-- Safety scores history (for trend analysis)
CREATE TABLE IF NOT EXISTS score_history (
    id SERIAL PRIMARY KEY,
    locality_id INTEGER REFERENCES localities(id),
    building_id INTEGER REFERENCES buildings(id),
    score NUMERIC(5,2) NOT NULL,
    score_components JSONB DEFAULT '{}',
    computed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_score_history_locality ON score_history(locality_id, computed_at DESC);
CREATE INDEX idx_score_history_building ON score_history(building_id, computed_at DESC);

-- Builders (for track record pages)
CREATE TABLE IF NOT EXISTS builders (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    total_projects INTEGER DEFAULT 0,
    completed_projects INTEGER DEFAULT 0,
    delayed_projects INTEGER DEFAULT 0,
    avg_delay_months NUMERIC(5,2),
    rera_complaints_total INTEGER DEFAULT 0,
    court_cases INTEGER DEFAULT 0,
    reputation_score NUMERIC(5,2),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Leads (for monetization)
CREATE TABLE IF NOT EXISTS leads (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    phone VARCHAR(20),
    email VARCHAR(255),
    lead_type VARCHAR(50),  -- broker, moving, home_loan, pest_control
    locality_id INTEGER REFERENCES localities(id),
    building_id INTEGER REFERENCES buildings(id),
    source_page TEXT,
    status VARCHAR(50) DEFAULT 'new',  -- new, contacted, converted
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
