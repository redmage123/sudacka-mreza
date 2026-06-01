// Load /app/sudovi-jurisdiction.jsonl into the courts.jurisdiction_scope
// column as Payload richText (Lexical) JSON. Touches every court row
// matching the scraped name (handles the duplicate-name rows the DB
// already had).
import fs from 'node:fs/promises'
import pg from 'pg'

const ALIASES = {
  'Visoki prekršajni sud Republike Hrvatske': 'Visoki prekršajni sud RH',
  'Visoki trgovački sud RH':                  'Visoki trgovački sud Republike Hrvatske',
  'Visoki upravni sud RH':                    'Visoki upravni sud Republike Hrvatske',
  'Općinski sud u Puli-Pola':                 'Općinski sud u Puli - Pola',
  'Županijski sud u Puli-Pola':               'Županijski sud u Puli - Pola',
}

function richTextRoot(text) {
  return {
    root: {
      type: 'root', version: 1, indent: 0, format: '', direction: 'ltr',
      children: [
        {
          type: 'paragraph', version: 1, indent: 0, format: '', direction: 'ltr', textFormat: 0,
          children: [
            { type: 'text', version: 1, mode: 'normal', style: '', detail: 0, format: 0, text },
          ],
        },
      ],
    },
  }
}

const txt = await fs.readFile('/app/sudovi-jurisdiction.jsonl', 'utf-8')
const records = txt.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l))

const client = new pg.Client({ connectionString: process.env.DATABASE_URI })
await client.connect()

const all = await client.query('SELECT id, name FROM courts')
const fold = (s) =>
  s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
const byFolded = new Map()
for (const r of all.rows) {
  const k = fold(r.name)
  if (!byFolded.has(k)) byFolded.set(k, [])
  byFolded.get(k).push(r.id)
}

let matched = 0, updates = 0
for (const rec of records) {
  const ids = byFolded.get(fold(ALIASES[rec.name] || rec.name)) || []
  if (!ids.length) continue
  matched++
  const json = JSON.stringify(richTextRoot(rec.text))
  for (const id of ids) {
    await client.query('UPDATE courts SET jurisdiction_scope = $1 WHERE id = $2', [json, id])
    updates++
  }
}

console.log(`scraped: ${records.length}, matched names: ${matched}, rows updated: ${updates}`)
await client.end()
