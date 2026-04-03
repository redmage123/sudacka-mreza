/**
 * Croatian full-text search utilities
 *
 * Provides a single `croatianSearch()` function that searches across all
 * public content types in one round-trip-efficient set of parallel queries.
 *
 * Strategy per collection:
 *   • court-decisions — tsvector FTS with the `croatian` text search config
 *     (unaccent + simple, optional Hunspell).  ts_rank for relevance ordering,
 *     ts_headline for <mark>-wrapped excerpts.
 *   • expert-witnesses, interpreters, courts — pg_trgm similarity on the `name`
 *     column.  Both the stored name and the query are passed through unaccent()
 *     so "Covic" matches "Čović", "Duric" matches "Đurić", etc.
 *   • news-posts — tsvector FTS with the `croatian` config on the title column.
 *
 * Croatian diacritics handled transparently by unaccent at the DB layer:
 *   č / ć → c   š → s   đ → d   ž → z
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CollectionType = 'decision' | 'expert' | 'interpreter' | 'court' | 'news'

export interface SearchHit {
  type: CollectionType
  id: string
  title: string
  slug?: string
  /** <mark>-wrapped excerpt (decisions only) */
  excerpt?: string
  /** Relevance score from ts_rank or trigram similarity */
  rank: number
  meta?: Record<string, unknown>
}

export interface SearchGroup {
  docs: SearchHit[]
  total: number
}

export interface CroatianSearchResults {
  decisions: SearchGroup
  experts: SearchGroup
  interpreters: SearchGroup
  courts: SearchGroup
  news: SearchGroup
}

/** Minimal subset of the pg Pool interface we depend on */
type DBPool = {
  query: (
    sql: string,
    params: (string | number)[],
  ) => Promise<{ rows: Record<string, unknown>[] }>
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Global full-text + fuzzy search across all public content types.
 *
 * @param pool  PostgreSQL connection pool (payload.db.pool)
 * @param q     Raw user query (must be ≥ 2 chars; caller is responsible)
 * @param type  Optional collection filter: decisions|experts|interpreters|courts|news
 */
export async function croatianSearch(
  pool: DBPool,
  q: string,
  type?: string | null,
): Promise<CroatianSearchResults> {
  const should = (t: string) => !type || type === t
  // When a type filter is set, return more results for that group
  const lim = (t: string) => (type === t ? 20 : 3)

  const [decisionsRes, expertsRes, interpretersRes, courtsRes, newsRes] =
    await Promise.allSettled([
      should('decisions') ? searchDecisions(pool, q, lim('decisions')) : empty(),
      should('experts') ? searchByName(pool, 'expert_witnesses', 'expert', q, lim('experts')) : empty(),
      should('interpreters') ? searchByName(pool, 'interpreters', 'interpreter', q, lim('interpreters')) : empty(),
      should('courts') ? searchByName(pool, 'courts', 'court', q, lim('courts')) : empty(),
      should('news') ? searchNews(pool, q, lim('news')) : empty(),
    ])

  return {
    decisions: unwrap(decisionsRes),
    experts: unwrap(expertsRes),
    interpreters: unwrap(interpretersRes),
    courts: unwrap(courtsRes),
    news: unwrap(newsRes),
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function empty(): Promise<SearchGroup> {
  return Promise.resolve({ docs: [], total: 0 })
}

function unwrap(settled: PromiseSettledResult<SearchGroup>): SearchGroup {
  return settled.status === 'fulfilled' ? settled.value : { docs: [], total: 0 }
}

/**
 * Full-text search over court_decisions.
 * Uses the `croatian` text search configuration (unaccent → simple / Hunspell).
 * Queries the precomputed search_vector column + title + case_number.
 */
async function searchDecisions(
  pool: DBPool,
  q: string,
  limit: number,
): Promise<SearchGroup> {
  // The tsvector expression must match the GIN index definition from the
  // enable_pg_trgm migration so that PostgreSQL uses the index rather than
  // a sequential scan.
  const tsVectorExpr = `
    to_tsvector('croatian',
      coalesce(cd.full_text_plain, '') || ' ' ||
      coalesce(cd.search_vector,   '') || ' ' ||
      coalesce(cd.title,           '') || ' ' ||
      coalesce(cd.case_number,     '')
    )`
  const tsQueryExpr = `plainto_tsquery('croatian', $1)`

  const countSql = `
    SELECT COUNT(*) AS total
    FROM   court_decisions cd
    WHERE  ${tsVectorExpr} @@ ${tsQueryExpr}
  `

  const dataSql = `
    SELECT
      cd.id,
      cd.title,
      cd.slug,
      cd.case_number,
      cd.date,
      cd.decision_type,
      ts_rank(${tsVectorExpr}, ${tsQueryExpr})   AS rank,
      ts_headline(
        'croatian',
        coalesce(cd.full_text_plain, cd.search_vector, cd.title, ''),
        ${tsQueryExpr},
        'MaxFragments=1, MaxWords=30, MinWords=5, StartSel=<mark>, StopSel=</mark>'
      )                                           AS excerpt
    FROM   court_decisions cd
    WHERE  ${tsVectorExpr} @@ ${tsQueryExpr}
    ORDER BY rank DESC, cd.date DESC
    LIMIT  $2
  `

  const [countRes, dataRes] = await Promise.all([
    pool.query(countSql, [q]),
    pool.query(dataSql, [q, limit]),
  ])

  return {
    total: parseInt(String(countRes.rows[0]?.total ?? '0'), 10),
    docs: dataRes.rows.map((row) => ({
      type: 'decision' as const,
      id: String(row.id),
      title: String(row.title ?? ''),
      slug: row.slug ? String(row.slug) : undefined,
      excerpt: row.excerpt ? String(row.excerpt) : undefined,
      rank: Number(row.rank ?? 0),
      meta: {
        caseNumber: row.case_number ?? null,
        date: row.date ?? null,
        decisionType: row.decision_type ?? null,
      },
    })),
  }
}

/**
 * Fuzzy name search using pg_trgm.
 * Both the stored name and the user query are passed through unaccent() so
 * searching without diacritics ("Duric") finds entries with diacritics ("Đurić").
 * Falls back to an ILIKE scan for short queries below the similarity threshold.
 */
async function searchByName(
  pool: DBPool,
  table: string,
  type: CollectionType,
  q: string,
  limit: number,
): Promise<SearchGroup> {
  // Parameterised table names are not possible in PostgreSQL; we control the
  // input (it comes from this module's constants, never from user input).
  const countSql = `
    SELECT COUNT(*) AS total
    FROM   ${table}
    WHERE  similarity(unaccent(name), unaccent($1)) > 0.2
        OR unaccent(name) ILIKE '%' || unaccent($1) || '%'
  `

  const dataSql = `
    SELECT
      id,
      name,
      similarity(unaccent(name), unaccent($1)) AS rank
    FROM   ${table}
    WHERE  similarity(unaccent(name), unaccent($1)) > 0.2
        OR unaccent(name) ILIKE '%' || unaccent($1) || '%'
    ORDER  BY rank DESC, name
    LIMIT  $2
  `

  const [countRes, dataRes] = await Promise.all([
    pool.query(countSql, [q]),
    pool.query(dataSql, [q, limit]),
  ])

  return {
    total: parseInt(String(countRes.rows[0]?.total ?? '0'), 10),
    docs: dataRes.rows.map((row) => ({
      type,
      id: String(row.id),
      title: String(row.name ?? ''),
      rank: Number(row.rank ?? 0),
    })),
  }
}

/**
 * Full-text search over news_posts titles using the `croatian` config.
 */
async function searchNews(
  pool: DBPool,
  q: string,
  limit: number,
): Promise<SearchGroup> {
  const tsVectorExpr = `to_tsvector('croatian', coalesce(np.title, ''))`
  const tsQueryExpr  = `plainto_tsquery('croatian', $1)`

  const countSql = `
    SELECT COUNT(*) AS total
    FROM   news_posts np
    WHERE  ${tsVectorExpr} @@ ${tsQueryExpr}
  `

  const dataSql = `
    SELECT
      np.id,
      np.title,
      np.slug,
      np.published_at,
      ts_rank(${tsVectorExpr}, ${tsQueryExpr}) AS rank
    FROM   news_posts np
    WHERE  ${tsVectorExpr} @@ ${tsQueryExpr}
    ORDER  BY rank DESC, np.published_at DESC
    LIMIT  $2
  `

  const [countRes, dataRes] = await Promise.all([
    pool.query(countSql, [q]),
    pool.query(dataSql, [q, limit]),
  ])

  return {
    total: parseInt(String(countRes.rows[0]?.total ?? '0'), 10),
    docs: dataRes.rows.map((row) => ({
      type: 'news' as const,
      id: String(row.id),
      title: String(row.title ?? ''),
      slug: row.slug ? String(row.slug) : undefined,
      rank: Number(row.rank ?? 0),
      meta: { publishedAt: row.published_at ?? null },
    })),
  }
}
