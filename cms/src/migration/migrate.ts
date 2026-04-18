/**
 * migrate.ts — Sudačka Mreža data-migration CLI entry point
 *
 * Commands:
 *   scrape   — run scraper only  (writes data/*.json)
 *   import   — run importer only (reads data/*.json → Payload DB)
 *   all      — scrape then import (default when no argument given)
 *
 * npm scripts:
 *   npm run migrate:scrape   → tsx src/migration/migrate.ts scrape
 *   npm run migrate:import   → tsx src/migration/migrate.ts import
 *   npm run migrate          → tsx src/migration/migrate.ts all
 *
 * All scraper and importer env vars are respected (see each module for details).
 */

import { spawnSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

type Command = 'scrape' | 'import' | 'all'

function usage() {
  console.log(`
Usage: tsx src/migration/migrate.ts [command]

Commands:
  scrape   Crawl http://sudacka-mreza.hr and save JSON to src/migration/data/
  import   Read JSON files and insert records into Payload CMS
  all      Run scrape then import (default when no argument is given)

Env vars (scraper):
  SCRAPE_BASE_URL   Base URL to crawl          (default: http://sudacka-mreza.hr)
  SCRAPE_DELAY_MS   Delay between requests ms  (default: 500)
  SCRAPE_MAX_PAGES  Max pages per section      (default: 0 = unlimited)

Env vars (importer):
  IMPORT_DRY_RUN    'true' to preview without writing (default: false)
  IMPORT_BATCH      Progress log batch size          (default: 50)
  DATABASE_URI      PostgreSQL connection string
  PAYLOAD_SECRET    Payload secret key
`)
}

function runModule(filename: string): boolean {
  const filePath = path.join(__dirname, filename)
  console.log(`\n► Running ${filename}...`)
  const result = spawnSync(
    process.execPath,                       // node
    ['--import', 'tsx/esm', filePath],     // tsx ESM loader
    {
      stdio: 'inherit',
      env: process.env,
    },
  )
  if (result.error) {
    console.error('Failed to start process:', result.error)
    return false
  }
  return result.status === 0
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  const mins = Math.floor(ms / 60_000)
  const secs = Math.round((ms % 60_000) / 1000)
  return `${mins}m ${secs}s`
}

async function main() {
  const arg = (process.argv[2] ?? 'all').toLowerCase() as Command

  if (arg === 'help' || arg === '--help' || arg === '-h') {
    usage()
    process.exit(0)
  }

  const validCommands: Command[] = ['scrape', 'import', 'all']
  if (!validCommands.includes(arg)) {
    console.error(`Unknown command: "${arg}"`)
    usage()
    process.exit(1)
  }

  const runScrape = arg === 'scrape' || arg === 'all'
  const runImport = arg === 'import' || arg === 'all'

  const totalStart = Date.now()

  if (runScrape) {
    const start = Date.now()
    const ok = runModule('scraper.ts')
    const elapsed = formatDuration(Date.now() - start)
    if (!ok) {
      console.error(`\nScraper exited with errors after ${elapsed}. Aborting.`)
      process.exit(1)
    }
    console.log(`\n  Scrape completed in ${elapsed}`)
  }

  if (runImport) {
    const start = Date.now()
    const ok = runModule('importer.ts')
    const elapsed = formatDuration(Date.now() - start)
    if (!ok) {
      console.error(`\nImporter exited with errors after ${elapsed}.`)
      process.exit(1)
    }
    console.log(`\n  Import completed in ${elapsed}`)
  }

  const totalElapsed = formatDuration(Date.now() - totalStart)
  console.log(`\nMigration finished successfully in ${totalElapsed}.\n`)
}

main().catch(err => {
  console.error('Migration failed:', err)
  process.exit(1)
})
