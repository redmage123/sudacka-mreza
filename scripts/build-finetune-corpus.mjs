#!/usr/bin/env node
// Assemble the fine-tune corpus from what's already in the Toronto DB:
//   - court_decisions.full_text_plain (~9 K rows, 63 MB) — Croatian case law
//   - nn_acts.body_text — newly-ingested Narodne Novine legislation
//
// One JSONL row per document, fields: source, id, lang, date, title, text.
// Output is shipped to the pod for finetune-gemma-eurlex.py.
//
// Usage:
//   node build-finetune-corpus.mjs --out=/tmp/finetune-corpus.jsonl
import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'

const argv = process.argv.slice(2)
const getArg = (n, d) => {
  const a = argv.find((x) => x.startsWith(`--${n}=`))
  return a ? a.split('=')[1] : d
}
const PG_URL =
  process.env.DATABASE_URI ??
  'postgresql://postgres:Sudacka2026!SecureDB@localhost:5432/sudacka_mreza'
const OUT = getArg('out', '/tmp/finetune-corpus.jsonl')
const MIN_CHARS = parseInt(getArg('min-chars', '500'), 10)

const log = (...a) => console.log(new Date().toISOString(), ...a)

async function main() {
  const client = new pg.Client({ connectionString: PG_URL })
  await client.connect()
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  const fd = fs.openSync(OUT, 'w')

  let total = 0
  let bytes = 0

  // 1. Court decisions
  const decRes = await client.query(
    `SELECT id, title, case_number, date, full_text_plain, lang
       FROM court_decisions
       WHERE full_text_plain IS NOT NULL
         AND char_length(full_text_plain) >= $1`,
    [MIN_CHARS],
  )
  log(`decisions: ${decRes.rows.length} rows`)
  for (const row of decRes.rows) {
    const text = (row.full_text_plain || '').replace(/\s+/g, ' ').trim()
    if (text.length < MIN_CHARS) continue
    const obj = {
      source: 'court_decision',
      id: row.id,
      lang: row.lang || 'hr',
      date: row.date ? new Date(row.date).toISOString().slice(0, 10) : null,
      title: row.title || row.case_number || null,
      text,
    }
    const line = JSON.stringify(obj) + '\n'
    fs.writeSync(fd, line)
    total += 1
    bytes += line.length
  }

  // 2. NN acts
  try {
    const nnRes = await client.query(
      `SELECT eli, title, issued_date, body_text
         FROM nn_acts
         WHERE body_text IS NOT NULL
           AND char_length(body_text) >= $1`,
      [MIN_CHARS],
    )
    log(`nn_acts: ${nnRes.rows.length} rows`)
    for (const row of nnRes.rows) {
      const text = (row.body_text || '').replace(/\s+/g, ' ').trim()
      if (text.length < MIN_CHARS) continue
      const obj = {
        source: 'nn_act',
        id: row.eli,
        lang: 'hr',
        date: row.issued_date ? new Date(row.issued_date).toISOString().slice(0, 10) : null,
        title: row.title || row.eli,
        text,
      }
      const line = JSON.stringify(obj) + '\n'
      fs.writeSync(fd, line)
      total += 1
      bytes += line.length
    }
  } catch (e) {
    log(`! nn_acts skipped: ${String(e.message).slice(0, 100)}`)
  }

  fs.closeSync(fd)
  await client.end()
  log(`done — ${total} docs, ${(bytes / 1e6).toFixed(1)} MB → ${OUT}`)
}

main().catch((e) => {
  console.error('FATAL:', e)
  process.exit(1)
})
