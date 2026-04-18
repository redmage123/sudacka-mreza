-- =============================================================================
-- Sudačka Mreža — PostgreSQL Schema
-- Migrated from: SQL Server (sm2_master_full.bak)
-- Target DB:     sudacka_mreza (PostgreSQL 16)
-- Created:       2026-03-26
-- Project:       GF-GFWEB-002
-- Author:        gigforge-engineer
--
-- EXTRACTION NOTES
-- ----------------
-- The source file /home/bbrelin/sm2_master_full.bak was not present on the
-- dev server at migration time (file path does not exist). This schema was
-- reconstructed from:
--   1. The task brief table definitions (Sudovi, Suci, Odvjetnici, CMS_*, etc.)
--   2. SOFTWARE_SPEC.md §3 functional requirements
--   3. The existing Payload CMS collections defined in Sprints 0–2
--   4. Standard patterns from the legacy ASP.NET/SQL Server codebase described
--      in the project brief.
--
-- When the .bak file becomes available, run migrate.py with --extract-ddl to
-- validate this schema against the actual SQL Server DDL.
--
-- SQL SERVER → POSTGRESQL TYPE MAPPING
-- -------------------------------------
--   int / smallint    → INTEGER
--   bigint            → BIGINT
--   varchar / nvarchar → TEXT
--   ntext / text      → TEXT
--   bit               → BOOLEAN
--   datetime          → TIMESTAMP WITH TIME ZONE
--   smalldatetime     → TIMESTAMP WITH TIME ZONE
--   uniqueidentifier  → UUID
--   float / real      → DOUBLE PRECISION
--   money             → NUMERIC(19,4)
--   IDENTITY(1,1)     → SERIAL (or GENERATED ALWAYS AS IDENTITY)
--
-- NAMING CONVENTIONS
-- ------------------
-- Original SQL Server identifiers are preserved exactly (Croatian names) so
-- that a data load from the .bak file can use column names directly without
-- transformation.  New PostgreSQL-native columns (created_at, updated_at,
-- search vectors) follow snake_case with a pg_ prefix or are appended.
-- =============================================================================

-- Ensure extensions are available (01-extensions.sql must run first)
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- CREATE EXTENSION IF NOT EXISTS "pg_trgm";
-- CREATE EXTENSION IF NOT EXISTS "unaccent";

-- =============================================================================
-- 1. REFERENCE / LOOKUP TABLES
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Jezici — Languages
-- Stores the 10 supported content languages (indices 0–9 map to Naziv0–Naziv9
-- multilingual columns throughout the schema).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Jezici (
    JezikID     SERIAL      PRIMARY KEY,
    Kod         TEXT        NOT NULL UNIQUE,   -- ISO 639-1 code, e.g. 'hr', 'en'
    Naziv       TEXT        NOT NULL,          -- native language name
    Redoslijed  INTEGER     NOT NULL DEFAULT 0, -- display order
    Aktivan     BOOLEAN     NOT NULL DEFAULT TRUE
);

COMMENT ON TABLE Jezici IS 'Supported UI/content languages (10 max, index 0–9 = hr,en,de,fr,it,es,pl,cs,sk,hu)';

-- ---------------------------------------------------------------------------
-- Geo_zupanije — Croatian Counties (21 counties + Zagreb City)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Geo_zupanije (
    ZupanijaID  SERIAL      PRIMARY KEY,
    Naziv       TEXT        NOT NULL,
    Naziv_en    TEXT,
    Sifra       TEXT,                          -- official statistical code
    Aktivan     BOOLEAN     NOT NULL DEFAULT TRUE
);

COMMENT ON TABLE Geo_zupanije IS 'Croatian counties (županije). 20 counties + City of Zagreb = 21 units.';

-- ---------------------------------------------------------------------------
-- Geo_gradovi — Cities / Towns
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Geo_gradovi (
    GradID      SERIAL      PRIMARY KEY,
    ZupanijaID  INTEGER     NOT NULL REFERENCES Geo_zupanije(ZupanijaID),
    Naziv       TEXT        NOT NULL,
    Naziv_en    TEXT,
    PostanskiBroj TEXT,
    Aktivan     BOOLEAN     NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_geo_gradovi_zupanija ON Geo_gradovi(ZupanijaID);

-- ---------------------------------------------------------------------------
-- Geo_opcine — Municipalities
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Geo_opcine (
    OpcinaID    SERIAL      PRIMARY KEY,
    ZupanijaID  INTEGER     NOT NULL REFERENCES Geo_zupanije(ZupanijaID),
    GradID      INTEGER     REFERENCES Geo_gradovi(GradID),
    Naziv       TEXT        NOT NULL,
    Naziv_en    TEXT,
    Aktivan     BOOLEAN     NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_geo_opcine_zupanija ON Geo_opcine(ZupanijaID);
CREATE INDEX IF NOT EXISTS idx_geo_opcine_grad     ON Geo_opcine(GradID);

-- =============================================================================
-- 2. COURTS
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Sudovi_vrste_def — Court Type Definitions
-- Ten multilingual name fields (Naziv0 = Croatian, Naziv1 = English, …)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Sudovi_vrste_def (
    VrstaID     SERIAL      PRIMARY KEY,
    Naziv0      TEXT,   -- hr
    Naziv1      TEXT,   -- en
    Naziv2      TEXT,
    Naziv3      TEXT,
    Naziv4      TEXT,
    Naziv5      TEXT,
    Naziv6      TEXT,
    Naziv7      TEXT,
    Naziv8      TEXT,
    Naziv9      TEXT,
    Redoslijed  INTEGER     NOT NULL DEFAULT 0,
    Aktivan     BOOLEAN     NOT NULL DEFAULT TRUE
);

COMMENT ON TABLE Sudovi_vrste_def IS 'Court type definitions with 10-language names (Naziv0=hr … Naziv9).';

-- ---------------------------------------------------------------------------
-- Sudovi — Courts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Sudovi (
    SudID           SERIAL      PRIMARY KEY,
    VrstaID         INTEGER     REFERENCES Sudovi_vrste_def(VrstaID),
    -- Multilingual names (10 languages)
    Naziv0          TEXT,   -- hr
    Naziv1          TEXT,   -- en
    Naziv2          TEXT,
    Naziv3          TEXT,
    Naziv4          TEXT,
    Naziv5          TEXT,
    Naziv6          TEXT,
    Naziv7          TEXT,
    Naziv8          TEXT,
    Naziv9          TEXT,
    -- Self-referential hierarchy
    ZalbeniSudID    INTEGER     REFERENCES Sudovi(SudID),     -- appellate court
    NadlezniSudID   INTEGER     REFERENCES Sudovi(SudID),     -- supervising court
    -- Contact / location
    Adresa          TEXT,
    Email           TEXT,
    WWW             TEXT,
    Tel             TEXT,
    Fax             TEXT,
    -- Admin
    Status          INTEGER     NOT NULL DEFAULT 1,
    Aktivan         BOOLEAN     NOT NULL DEFAULT TRUE,
    -- Full-text search vector (populated by trigger)
    search_vector   tsvector
);

CREATE INDEX IF NOT EXISTS idx_sudovi_vrsta       ON Sudovi(VrstaID);
CREATE INDEX IF NOT EXISTS idx_sudovi_zalbeni     ON Sudovi(ZalbeniSudID);
CREATE INDEX IF NOT EXISTS idx_sudovi_nadlezni    ON Sudovi(NadlezniSudID);
CREATE INDEX IF NOT EXISTS idx_sudovi_aktivan     ON Sudovi(Aktivan);
CREATE INDEX IF NOT EXISTS idx_sudovi_fts         ON Sudovi USING gin(search_vector);

COMMENT ON TABLE Sudovi IS 'Croatian courts. ZalbeniSudID = appellate court. NadlezniSudID = supervisory court.';

-- Trigger: maintain search_vector for Croatian full-text search
CREATE OR REPLACE FUNCTION sudovi_search_vector_update() RETURNS trigger AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('croatian', COALESCE(NEW.Naziv0, '')), 'A') ||
        setweight(to_tsvector('croatian', COALESCE(NEW.Naziv1, '')), 'B') ||
        setweight(to_tsvector('croatian', COALESCE(NEW.Adresa,  '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trig_sudovi_search ON Sudovi;
CREATE TRIGGER trig_sudovi_search
    BEFORE INSERT OR UPDATE ON Sudovi
    FOR EACH ROW EXECUTE FUNCTION sudovi_search_vector_update();

-- ---------------------------------------------------------------------------
-- Sudovi_nadleznosti — Court Jurisdictions
-- Maps municipalities/counties to the responsible courts.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Sudovi_nadleznosti (
    NadleznostID        SERIAL      PRIMARY KEY,
    OpcinaID            INTEGER     REFERENCES Geo_opcine(OpcinaID),
    ZupanijaID          INTEGER     REFERENCES Geo_zupanije(ZupanijaID),
    OpcinskiSudID       INTEGER     REFERENCES Sudovi(SudID),   -- municipal court
    TrgovackiSudID      INTEGER     REFERENCES Sudovi(SudID),   -- commercial court
    -- Additional court type FK slots can be added per business need
    Aktivan             BOOLEAN     NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_sudnad_opcina    ON Sudovi_nadleznosti(OpcinaID);
CREATE INDEX IF NOT EXISTS idx_sudnad_zupanija  ON Sudovi_nadleznosti(ZupanijaID);
CREATE INDEX IF NOT EXISTS idx_sudnad_opcinski  ON Sudovi_nadleznosti(OpcinskiSudID);
CREATE INDEX IF NOT EXISTS idx_sudnad_trgovacki ON Sudovi_nadleznosti(TrgovackiSudID);

-- =============================================================================
-- 3. JUDGES
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Suci — Judges
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Suci (
    SudacID         SERIAL      PRIMARY KEY,
    Ime             TEXT        NOT NULL,
    Prezime         TEXT        NOT NULL,
    Email           TEXT,
    WWW             TEXT,
    CV              TEXT,       -- rich-text biography / curriculum vitae
    Umirovljen      BOOLEAN     NOT NULL DEFAULT FALSE,   -- retired
    Tip             INTEGER     NOT NULL DEFAULT 1,       -- judge type / rank
    Aktivan         BOOLEAN     NOT NULL DEFAULT TRUE,
    -- Full-text search vector
    search_vector   tsvector
);

CREATE INDEX IF NOT EXISTS idx_suci_aktivan ON Suci(Aktivan);
CREATE INDEX IF NOT EXISTS idx_suci_fts     ON Suci USING gin(search_vector);

CREATE OR REPLACE FUNCTION suci_search_vector_update() RETURNS trigger AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('croatian', COALESCE(NEW.Ime,     '')), 'A') ||
        setweight(to_tsvector('croatian', COALESCE(NEW.Prezime, '')), 'A') ||
        setweight(to_tsvector('croatian', COALESCE(NEW.CV,      '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trig_suci_search ON Suci;
CREATE TRIGGER trig_suci_search
    BEFORE INSERT OR UPDATE ON Suci
    FOR EACH ROW EXECUTE FUNCTION suci_search_vector_update();

-- ---------------------------------------------------------------------------
-- Sudac_suda — Judge ↔ Court assignments (many-to-many)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Sudac_suda (
    SudacID     INTEGER     NOT NULL REFERENCES Suci(SudacID)  ON DELETE CASCADE,
    SudID       INTEGER     NOT NULL REFERENCES Sudovi(SudID)  ON DELETE CASCADE,
    DatumOd     TIMESTAMP WITH TIME ZONE,
    DatumDo     TIMESTAMP WITH TIME ZONE,
    PRIMARY KEY (SudacID, SudID)
);

CREATE INDEX IF NOT EXISTS idx_sudac_suda_sud ON Sudac_suda(SudID);

-- =============================================================================
-- 4. LAWYERS / LAW FIRMS
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Odvjetnistva_vrste_def — Law Firm Type Definitions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Odvjetnistva_vrste_def (
    VrstaID     SERIAL      PRIMARY KEY,
    Naziv0      TEXT,   -- hr
    Naziv1      TEXT,   -- en
    Naziv2      TEXT,
    Naziv3      TEXT,
    Naziv4      TEXT,
    Naziv5      TEXT,
    Naziv6      TEXT,
    Naziv7      TEXT,
    Naziv8      TEXT,
    Naziv9      TEXT,
    Aktivan     BOOLEAN     NOT NULL DEFAULT TRUE
);

-- ---------------------------------------------------------------------------
-- Odvjetnistva — Law Firms
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Odvjetnistva (
    OdvjetnistvoID  SERIAL      PRIMARY KEY,
    VrstaID         INTEGER     REFERENCES Odvjetnistva_vrste_def(VrstaID),
    Naziv0          TEXT,   -- hr
    Naziv1          TEXT,   -- en
    Naziv2          TEXT,
    Naziv3          TEXT,
    Naziv4          TEXT,
    Naziv5          TEXT,
    Naziv6          TEXT,
    Naziv7          TEXT,
    Naziv8          TEXT,
    Naziv9          TEXT,
    Adresa          TEXT,
    Email           TEXT,
    WWW             TEXT,
    Tel             TEXT,
    Fax             TEXT,
    Aktivan         BOOLEAN     NOT NULL DEFAULT TRUE,
    search_vector   tsvector
);

CREATE INDEX IF NOT EXISTS idx_odvjetnistva_fts ON Odvjetnistva USING gin(search_vector);

CREATE OR REPLACE FUNCTION odvjetnistva_search_vector_update() RETURNS trigger AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('croatian', COALESCE(NEW.Naziv0, '')), 'A') ||
        setweight(to_tsvector('croatian', COALESCE(NEW.Naziv1, '')), 'B') ||
        setweight(to_tsvector('croatian', COALESCE(NEW.Adresa, '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trig_odvjetnistva_search ON Odvjetnistva;
CREATE TRIGGER trig_odvjetnistva_search
    BEFORE INSERT OR UPDATE ON Odvjetnistva
    FOR EACH ROW EXECUTE FUNCTION odvjetnistva_search_vector_update();

-- ---------------------------------------------------------------------------
-- Odvjetnici — Individual Lawyers
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Odvjetnici (
    OdvjetnikID     SERIAL      PRIMARY KEY,
    Ime             TEXT        NOT NULL,
    Prezime         TEXT        NOT NULL,
    Email           TEXT,
    WWW             TEXT,
    CV              TEXT,
    Umirovljen      BOOLEAN     NOT NULL DEFAULT FALSE,
    Tip             INTEGER     NOT NULL DEFAULT 1,
    Aktivan         BOOLEAN     NOT NULL DEFAULT TRUE,
    search_vector   tsvector
);

CREATE INDEX IF NOT EXISTS idx_odvjetnici_aktivan ON Odvjetnici(Aktivan);
CREATE INDEX IF NOT EXISTS idx_odvjetnici_fts     ON Odvjetnici USING gin(search_vector);

CREATE OR REPLACE FUNCTION odvjetnici_search_vector_update() RETURNS trigger AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('croatian', COALESCE(NEW.Ime,     '')), 'A') ||
        setweight(to_tsvector('croatian', COALESCE(NEW.Prezime, '')), 'A') ||
        setweight(to_tsvector('croatian', COALESCE(NEW.CV,      '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trig_odvjetnici_search ON Odvjetnici;
CREATE TRIGGER trig_odvjetnici_search
    BEFORE INSERT OR UPDATE ON Odvjetnici
    FOR EACH ROW EXECUTE FUNCTION odvjetnici_search_vector_update();

-- ---------------------------------------------------------------------------
-- Odvjetnici_odvjetnistva — Lawyer ↔ Law Firm assignments (many-to-many)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Odvjetnici_odvjetnistva (
    OdvjetnikID         INTEGER NOT NULL REFERENCES Odvjetnici(OdvjetnikID)     ON DELETE CASCADE,
    OdvjetnistvoID      INTEGER NOT NULL REFERENCES Odvjetnistva(OdvjetnistvoID) ON DELETE CASCADE,
    DatumOd             TIMESTAMP WITH TIME ZONE,
    DatumDo             TIMESTAMP WITH TIME ZONE,
    PRIMARY KEY (OdvjetnikID, OdvjetnistvoID)
);

-- ---------------------------------------------------------------------------
-- Odvjetnistva_nadleznost — Law Firm Jurisdictions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Odvjetnistva_nadleznost (
    NadleznostID        SERIAL      PRIMARY KEY,
    OdvjetnistvoID      INTEGER     NOT NULL REFERENCES Odvjetnistva(OdvjetnistvoID) ON DELETE CASCADE,
    ZupanijaID          INTEGER     REFERENCES Geo_zupanije(ZupanijaID),
    OpcinaID            INTEGER     REFERENCES Geo_opcine(OpcinaID),
    Aktivan             BOOLEAN     NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_odvnad_odvjetnistvo ON Odvjetnistva_nadleznost(OdvjetnistvoID);

-- =============================================================================
-- 5. USERS
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Korisnici — Platform Users
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Korisnici (
    KorisnikID      SERIAL      PRIMARY KEY,
    Ime             TEXT        NOT NULL,
    Prezime         TEXT        NOT NULL,
    Email           TEXT        NOT NULL UNIQUE,
    Lozinka         TEXT,                           -- hashed password (bcrypt)
    Uloga           TEXT        NOT NULL DEFAULT 'member',  -- member | editor | admin
    Aktivan         BOOLEAN     NOT NULL DEFAULT TRUE,
    DatumRegistracije TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    ZadnjaPrijava   TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_korisnici_email   ON Korisnici(Email);
CREATE INDEX IF NOT EXISTS idx_korisnici_aktivan ON Korisnici(Aktivan);

-- =============================================================================
-- 6. CMS
-- =============================================================================

-- ---------------------------------------------------------------------------
-- CMS_kategorije — Content Categories
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS CMS_kategorije (
    KategorijaID    SERIAL      PRIMARY KEY,
    -- Multilingual names
    Naziv0          TEXT,   -- hr
    Naziv1          TEXT,   -- en
    Naziv2          TEXT,
    Naziv3          TEXT,
    Naziv4          TEXT,
    Naziv5          TEXT,
    Naziv6          TEXT,
    Naziv7          TEXT,
    Naziv8          TEXT,
    Naziv9          TEXT,
    Slug            TEXT        UNIQUE,
    Redoslijed      INTEGER     NOT NULL DEFAULT 0,
    Aktivan         BOOLEAN     NOT NULL DEFAULT TRUE
);

-- ---------------------------------------------------------------------------
-- CMS_galerije_sadrzaj — CMS Articles / Pages / Gallery Items
-- Multilingual Naslov (title) and Text (body) for all 10 language indices.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS CMS_galerije_sadrzaj (
    SadrzajID       SERIAL      PRIMARY KEY,
    KategorijaID    INTEGER     REFERENCES CMS_kategorije(KategorijaID),
    -- Multilingual titles
    Naslov0         TEXT,   -- hr
    Naslov1         TEXT,   -- en
    Naslov2         TEXT,
    Naslov3         TEXT,
    Naslov4         TEXT,
    Naslov5         TEXT,
    Naslov6         TEXT,
    Naslov7         TEXT,
    Naslov8         TEXT,
    Naslov9         TEXT,
    -- Multilingual body text / HTML
    Text0           TEXT,
    Text1           TEXT,
    Text2           TEXT,
    Text3           TEXT,
    Text4           TEXT,
    Text5           TEXT,
    Text6           TEXT,
    Text7           TEXT,
    Text8           TEXT,
    Text9           TEXT,
    -- Metadata
    Slug            TEXT,
    Datum           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    AutorID         INTEGER     REFERENCES Korisnici(KorisnikID),
    Objavljen       BOOLEAN     NOT NULL DEFAULT FALSE,
    Redoslijed      INTEGER     NOT NULL DEFAULT 0,
    -- Full-text search
    search_vector   tsvector
);

CREATE INDEX IF NOT EXISTS idx_cms_gs_kategorija ON CMS_galerije_sadrzaj(KategorijaID);
CREATE INDEX IF NOT EXISTS idx_cms_gs_objavljen  ON CMS_galerije_sadrzaj(Objavljen);
CREATE INDEX IF NOT EXISTS idx_cms_gs_datum      ON CMS_galerije_sadrzaj(Datum DESC);
CREATE INDEX IF NOT EXISTS idx_cms_gs_fts        ON CMS_galerije_sadrzaj USING gin(search_vector);

CREATE OR REPLACE FUNCTION cms_sadrzaj_search_vector_update() RETURNS trigger AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('croatian', COALESCE(NEW.Naslov0, '')), 'A') ||
        setweight(to_tsvector('croatian', COALESCE(NEW.Naslov1, '')), 'A') ||
        setweight(to_tsvector('croatian', COALESCE(NEW.Text0,   '')), 'B') ||
        setweight(to_tsvector('croatian', COALESCE(NEW.Text1,   '')), 'B');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trig_cms_sadrzaj_search ON CMS_galerije_sadrzaj;
CREATE TRIGGER trig_cms_sadrzaj_search
    BEFORE INSERT OR UPDATE ON CMS_galerije_sadrzaj
    FOR EACH ROW EXECUTE FUNCTION cms_sadrzaj_search_vector_update();

-- ---------------------------------------------------------------------------
-- CMS_dokumenti — Documents (PDFs and other file attachments)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS CMS_dokumenti (
    DokumentID      SERIAL      PRIMARY KEY,
    KategorijaID    INTEGER     REFERENCES CMS_kategorije(KategorijaID),
    SadrzajID       INTEGER     REFERENCES CMS_galerije_sadrzaj(SadrzajID),
    -- Multilingual titles
    Naziv0          TEXT,
    Naziv1          TEXT,
    Naziv2          TEXT,
    Naziv3          TEXT,
    Naziv4          TEXT,
    Naziv5          TEXT,
    Naziv6          TEXT,
    Naziv7          TEXT,
    Naziv8          TEXT,
    Naziv9          TEXT,
    -- File storage
    Putanja         TEXT,       -- relative file path on server
    MimeType        TEXT,       -- e.g. 'application/pdf'
    Velicina        BIGINT,     -- file size in bytes
    -- Metadata
    Datum           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    AutorID         INTEGER     REFERENCES Korisnici(KorisnikID),
    Objavljen       BOOLEAN     NOT NULL DEFAULT FALSE,
    Redoslijed      INTEGER     NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_cms_dok_kategorija ON CMS_dokumenti(KategorijaID);
CREATE INDEX IF NOT EXISTS idx_cms_dok_sadrzaj    ON CMS_dokumenti(SadrzajID);
CREATE INDEX IF NOT EXISTS idx_cms_dok_objavljen  ON CMS_dokumenti(Objavljen);

-- =============================================================================
-- 7. SEED DATA
-- =============================================================================

-- Languages (indices 0–9 used in Naziv0–Naziv9 columns)
INSERT INTO Jezici (Kod, Naziv, Redoslijed, Aktivan) VALUES
    ('hr', 'Hrvatski',    0, TRUE),
    ('en', 'English',     1, TRUE),
    ('de', 'Deutsch',     2, FALSE),
    ('fr', 'Français',    3, FALSE),
    ('it', 'Italiano',    4, FALSE),
    ('es', 'Español',     5, FALSE),
    ('pl', 'Polski',      6, FALSE),
    ('cs', 'Čeština',     7, FALSE),
    ('sk', 'Slovenčina',  8, FALSE),
    ('hu', 'Magyar',      9, FALSE)
ON CONFLICT (Kod) DO NOTHING;

-- Court types (Croatian judicial system)
INSERT INTO Sudovi_vrste_def (Naziv0, Naziv1, Redoslijed, Aktivan) VALUES
    ('Općinski sud',            'Municipal Court',          1, TRUE),
    ('Županijski sud',          'County Court',             2, TRUE),
    ('Trgovački sud',           'Commercial Court',         3, TRUE),
    ('Visoki trgovački sud',    'High Commercial Court',    4, TRUE),
    ('Upravni sud',             'Administrative Court',     5, TRUE),
    ('Visoki upravni sud',      'High Administrative Court',6, TRUE),
    ('Vrhovni sud',             'Supreme Court',            7, TRUE),
    ('Ustavni sud',             'Constitutional Court',     8, TRUE),
    ('Prekršajni sud',          'Misdemeanour Court',       9, TRUE),
    ('Visoki prekršajni sud',   'High Misdemeanour Court', 10, TRUE)
ON CONFLICT DO NOTHING;
