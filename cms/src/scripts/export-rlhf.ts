/**
 * Export approved chat-feedback rows as Alpaca-style JSONL for the next
 * fine-tune cycle.
 *
 *   pnpm exec tsx cms/src/scripts/export-rlhf.ts \
 *     --out /home/bbrelin/sudacka-finetune/data/rlhf/$(date +%Y%m%d).jsonl
 *
 * Each row produces one example:
 *   { "instruction": "<question>",
 *     "input": "",
 *     "output": "<correction>",
 *     "lang": "<lang>",
 *     "feedback_id": "<id>" }
 *
 * Only rows with status=approved AND a non-empty correction are exported.
 */
import fs from 'node:fs'
import path from 'node:path'
import { getPayload } from 'payload'
import config from '../payload.config.js'

interface FeedbackRow {
  id: string
  question: string
  lang: string
  modelAnswer: string
  correction?: string | null
  status: string
}

function arg(flag: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(flag)
  if (i > -1 && process.argv[i + 1]) return process.argv[i + 1]
  return fallback
}

async function main(): Promise<void> {
  const outPath = arg('--out')
  if (!outPath) {
    console.error('usage: export-rlhf --out <path.jsonl>')
    process.exit(2)
  }
  const payload = await getPayload({ config })
  const limit = 500
  let page = 1
  let written = 0
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  const fd = fs.openSync(outPath, 'w')
  try {
    for (;;) {
      const r = await payload.find({
        collection: 'chat-feedback',
        where: {
          and: [
            { status: { equals: 'approved' } },
            { correction: { not_equals: null } },
          ],
        },
        limit,
        page,
        depth: 0,
        overrideAccess: true,
      })
      const rows = r.docs as unknown as FeedbackRow[]
      for (const row of rows) {
        if (!row.correction || !row.correction.trim()) continue
        const obj = {
          instruction: row.question,
          input: '',
          output: row.correction.trim(),
          lang: row.lang,
          feedback_id: row.id,
        }
        fs.writeSync(fd, JSON.stringify(obj) + '\n')
        written += 1
      }
      if (!r.hasNextPage) break
      page += 1
    }
  } finally {
    fs.closeSync(fd)
  }
  console.log(`wrote ${written} examples → ${outPath}`)
  process.exit(0)
}

void main().catch((e) => {
  console.error(e)
  process.exit(1)
})
