#!/usr/bin/env node
// Chunk + embed + upsert EUR-Lex full-text bodies into eurlex_docs.
//
// Reads corpus_<lang>.jsonl (one {celex,lang,date,text} per line), splits the
// body into ~512-char chunks at sentence boundaries, calls the local Ollama
// nomic-embed-text endpoint for each chunk, and inserts as
// (celex, lang, chunk_idx>=1) rows. chunk_idx=0 (title) rows are kept as-is.
//
// Resumable via a cursor file that records the highest line number processed.
//
// Usage:
//   node eurlex-ingest.mjs --in=corpus_en.jsonl --cursor=en.cursor --lang=en
import fs from 'node:fs'
import readline from 'node:readline'
import { execSync } from 'node:child_process'

const argv = process.argv.slice(2)
const arg = (n, dflt) => {
  const a = argv.find((x) => x.startsWith(`--${n}=`))
  return a ? a.split('=')[1] : dflt
}
const IN = arg('in')
const CURSOR = arg('cursor')
const LANG = arg('lang')
if (!IN || !CURSOR || !LANG) {
  console.error('usage: --in=<jsonl> --cursor=<cursorfile> --lang=<en|hr>')
  process.exit(2)
}

const OLLAMA = process.env.OLLAMA_URL || 'http://172.18.0.1:11434'
const EMBED_MODEL = process.env.EMBED_MODEL || 'nomic-embed-text'
const CHUNK_SIZE = 512
const MAX_CHUNKS_PER_DOC = 80
const COMMIT_BATCH = 50

const PG = 'docker exec -i sudacka-mreza-db-1 psql -U postgres -d sudacka_mreza -v ON_ERROR_STOP=1 -X -At -F: -q'

const ts = () => new Date().toISOString()
const log = (...a) => console.log(ts(), ...a)

function chunkText(text) {
  const sentences = text.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+(?=[A-ZŠĐČĆŽ0-9])/)
  const chunks = []
  let cur = ''
  for (const s of sentences) {
    if (cur.length + s.length + 1 > CHUNK_SIZE) {
      if (cur) chunks.push(cur.trim())
      cur = s
    } else {
      cur = cur ? `${cur} ${s}` : s
    }
    if (chunks.length >= MAX_CHUNKS_PER_DOC) break
  }
  if (cur && chunks.length < MAX_CHUNKS_PER_DOC) chunks.push(cur.trim())
  return chunks.filter((c) => c.length >= 60)
}

async function embed(text) {
  const r = await fetch(`${OLLAMA}/api/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: EMBED_MODEL, input: text }),
    signal: AbortSignal.timeout(60_000),
  })
  if (!r.ok) throw new Error(`embed HTTP ${r.status}`)
  const j = await r.json()
  return j.embeddings?.[0] || null
}

function pgEscape(s) {
  return s.replace(/'/g, "''")
}

function buildSQL(rows) {
  // Multi-row INSERT into eurlex_docs. Each row: celex, lang, scope, date,
  // title, chunk_idx, chunk_text, embedding.
  const values = rows
    .map(
      (r) =>
        `('${pgEscape(r.celex)}','${pgEscape(r.lang)}','${pgEscape(r.scope)}',` +
        (r.date ? `'${pgEscape(r.date)}'` : 'NULL') +
        `,${r.title ? `'${pgEscape(r.title)}'` : 'NULL'},${r.chunk_idx},'${pgEscape(r.chunk_text)}','[${r.embedding.join(',')}]'::vector)`,
    )
    .join(',\n')
  return `INSERT INTO eurlex_docs (celex, lang, scope, date, title, chunk_idx, chunk_text, embedding) VALUES\n${values}\nON CONFLICT (celex, lang, chunk_idx) DO NOTHING;`
}

function commitBatch(rows) {
  if (rows.length === 0) return
  const sql = buildSQL(rows)
  execSync(PG, { input: sql, stdio: ['pipe', 'pipe', 'inherit'] })
}

function detectScope(celex) {
  return /^[36]/.test(celex) === false || celex.startsWith('6') ? 'caselaw' : 'legislation'
}

async function main() {
  const startLine = fs.existsSync(CURSOR) ? parseInt(fs.readFileSync(CURSOR, 'utf8').trim(), 10) || 0 : 0
  log(`ingest in=${IN} cursor=${startLine} lang=${LANG}`)

  const rl = readline.createInterface({ input: fs.createReadStream(IN), crlfDelay: Infinity })
  let lineNo = 0
  let processed = 0
  let inserted = 0
  let batch = []

  for await (const line of rl) {
    lineNo += 1
    if (lineNo <= startLine) continue
    if (!line.trim()) continue
    let obj
    try {
      obj = JSON.parse(line)
    } catch {
      continue
    }
    const text = (obj.text || '').trim()
    if (!text || text.length < 500) continue

    const scope = obj.celex.startsWith('6') ? 'caselaw' : 'legislation'
    const chunks = chunkText(text)
    let chunk_idx = 1
    for (const c of chunks) {
      try {
        const emb = await embed(c)
        if (!emb) continue
        batch.push({
          celex: obj.celex,
          lang: obj.lang,
          scope,
          date: obj.date || null,
          title: null,
          chunk_idx,
          chunk_text: c,
          embedding: emb,
        })
        chunk_idx += 1
        if (batch.length >= COMMIT_BATCH) {
          commitBatch(batch)
          inserted += batch.length
          batch = []
        }
      } catch (e) {
        log(`embed/insert failed celex=${obj.celex} chunk=${chunk_idx}: ${e.message}`)
      }
    }
    processed += 1
    if (processed % 25 === 0) log(`  processed=${processed} inserted=${inserted} line=${lineNo}`)
    fs.writeFileSync(CURSOR, String(lineNo))
  }
  if (batch.length) {
    commitBatch(batch)
    inserted += batch.length
  }
  fs.writeFileSync(CURSOR, String(lineNo))
  log(`done processed=${processed} inserted=${inserted} final_line=${lineNo}`)
}

main().catch((e) => {
  console.error('FATAL:', e)
  process.exit(1)
})
