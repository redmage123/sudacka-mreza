import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * ExpertWitnesses.lang and Interpreters.lang are Postgres enums that
 * shipped containing only ('hr', 'en'). The app supports 31 UI locales
 * total and the admin form now exposes the full list as the entry-
 * language picker, so we have to add the remaining 29 values to both
 * enums before any record can be saved with them.
 *
 * Note: ALTER TYPE ADD VALUE cannot run inside a transaction block in
 * Postgres < 12, but Payload migrations run in autocommit-friendly
 * mode and Postgres 12+ supports it as long as the new value isn't
 * referenced inside the same transaction.
 */
const NEW_LANGS = [
  'de', 'fr',
  'bg', 'cs', 'da', 'el', 'es', 'et', 'eu', 'fi', 'ga',
  'hu', 'is', 'it', 'ja', 'lt', 'lv', 'mt', 'nb', 'nl',
  'pl', 'pt', 'ro', 'sk', 'sl', 'sv', 'uk', 'ar', 'zh',
]

export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const code of NEW_LANGS) {
    await db.execute(sql.raw(
      `ALTER TYPE \"public\".\"enum_expert_witnesses_lang\" ADD VALUE IF NOT EXISTS '${code}'`
    ))
    await db.execute(sql.raw(
      `ALTER TYPE \"public\".\"enum_interpreters_lang\" ADD VALUE IF NOT EXISTS '${code}'`
    ))
  }
}

export async function down({ db: _db }: MigrateDownArgs): Promise<void> {
  // Reversing ALTER TYPE ADD VALUE in Postgres requires recreating the
  // enum from scratch which would cascade through every column. Not
  // safe to attempt automatically.
}
