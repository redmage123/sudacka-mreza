#!/usr/bin/env node
// EUR-Lex semantic indexer.
//
// Reads /workspace/eurlex/corpus.jsonl (one doc per line: celex, lang, date,
// text), splits text into ~600-token chunks, embeds each chunk via the
// pod's nomic-embed-text Ollama, and upserts into the eurlex_docs pgvector
// table on Toronto.
//
// Resumable: skips (celex, lang, chunk_idx) tuples already present.
//
// Usage:
//   node eurlex-index.mjs --corpus=/workspace/eurlex/corpus.jsonl \
//        --scope=caselaw \
//        --pg=postgres://... \
//        --ollama=http://127.0.0.1:11434 \
//        --concurrency=4
import fs from 'node:fs'
import readline from 'node:readline'
import pg from 'pg'

const argv = process.argv.slice(2)
const getArg = (n, dflt) => {
  const a = argv.find((x) => x.startsWith(`--${n}=`))
  return a ? a.split('=')[1] : dflt
}

const CORPUS = getArg('corpus', '/workspace/eurlex/corpus.jsonl')
const SCOPE = getArg('scope', 'caselaw')
const PG_URL =
  getArg('pg', null) ??
  process.env.DATABASE_URI ??
  'postgresql://postgres:postgres@localhost:5432/sudacka_mreza'
const OLLAMA = getArg('ollama', process.env.OLLAMA_BASE || 'http://127.0.0.1:11434')
const EMBED_MODEL = getArg('embed-model', 'nomic-embed-text')
const CONCURRENCY = parseInt(getArg('concurrency', '4'), 10)
const CHUNK_CHARS = parseInt(getArg('chunk-chars', '2400'), 10) // ~600 tokens
const CHUNK_OVERLAP = parseInt(getArg('chunk-overlap', '300'), 10)

const log = (...a) => console.log(new Date().toISOString(), ...a)

function chunkText(text, size, overlap) {
  const out = []
  let i = 0
  while (i < text.length) {
    out.push(text.slice(i, i + size))
    i += size - overlap
  }
  return out
}

async function embed(text) {
  const r = await fetch(`${OLLAMA}/api/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: EMBED_MODEL, input: text }),
  })
  if (!r.ok) throw new Error(`embed HTTP ${r.status}`)
  const j = await r.json()
  return j.embeddings?.[0]
}

function pgVecLit(v) {
  return `[${v.join(',')}]`
}

async function ensureSchema(client) {
  await client.query('CREATE EXTENSION IF NOT EXISTS vector')
  await client.query(`
    CREATE TABLE IF NOT EXISTS eurlex_docs (
      id          SERIAL PRIMARY KEY,
      celex       TEXT NOT NULL,
      lang        TEXT NOT NULL,
      scope       TEXT NOT NULL,
      date        DATE,
      title       TEXT,
      chunk_idx   INT NOT NULL DEFAULT 0,
      chunk_text  TEXT NOT NULL,
      embedding   vector(768),
      UNIQUE (celex, lang, chunk_idx)
    );
    CREATE INDEX IF NOT EXISTS eurlex_docs_celex_idx ON eurlex_docs(celex);
    CREATE INDEX IF NOT EXISTS eurlex_docs_scope_idx ON eurlex_docs(scope);
    CREATE INDEX IF NOT EXISTS eurlex_docs_lang_idx  ON eurlex_docs(lang);
  `)
}

async function main() {
  const client = new pg.Client({ connectionString: PG_URL })
  await client.connect()
  await ensureSchema(client)

  const stream = fs.createReadStream(CORPUS, { encoding: 'utf8' })
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity })

  let docCount = 0
  let chunkCount = 0
  const queue = []
  let flushPromise = Promise.resolve()

  const insertOne = async (job) => {
    try {
      const dup = await client.query(
        `SELECT 1 FROM eurlex_docs WHERE celex = $1 AND lang = $2 AND chunk_idx = $3 LIMIT 1`,
        [job.celex, job.lang, job.chunk_idx],
      )
      if (dup.rows.length > 0) return
      const v = await embed(job.chunk_text)
      if (!v || v.length === 0) return
      await client.query(
        `INSERT INTO eurlex_docs
           (celex, lang, scope, date, title, chunk_idx, chunk_text, embedding)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::vector)
         ON CONFLICT (celex, lang, chunk_idx) DO NOTHING`,
        [job.celex, job.lang, SCOPE, job.date, job.title, job.chunk_idx, job.chunk_text, pgVecLit(v)],
      )
      chunkCount++
    } catch (e) {
      log(`! embed/insert ${job.celex}/${job.lang}#${job.chunk_idx}: ${String(e.message).slice(0, 100)}`)
    }
  }

  const drain = async () => {
    while (queue.length >= CONCURRENCY) {
      await Promise.all(queue.splice(0, CONCURRENCY).map(insertOne))
    }
  }

  for await (const line of rl) {
    if (!line.trim()) continue
    let obj
    try {
      obj = JSON.parse(line)
    } catch {
      continue
    }
    docCount++
    const text = (obj.text || '').replace(/\s+/g, ' ').trim()
    if (text.length < 500) continue
    const title = (obj.title || obj.celex || '').slice(0, 500)
    const chunks = chunkText(text, CHUNK_CHARS, CHUNK_OVERLAP)
    chunks.forEach((c, idx) => {
      queue.push({
        celex: obj.celex,
        lang: obj.lang,
        date: obj.date ? new Date(obj.date) : null,
        title,
        chunk_idx: idx,
        chunk_text: c,
      })
    })
    if (queue.length >= 50) await drain()
    if (docCount % 200 === 0) log(`docs=${docCount} chunks=${chunkCount}`)
  }
  while (queue.length > 0) await drain()
  log(`done — docs=${docCount}, chunks=${chunkCount}`)
  await client.end()
}

main().catch((e) => {
  console.error('FATAL:', e)
  process.exit(1)
})
