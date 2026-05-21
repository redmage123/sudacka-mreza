import * as migration_20260321_191618 from './20260321_191618';
import * as migration_20260321_enable_pg_trgm from './20260321_enable_pg_trgm';
import * as migration_20260322_legal_categories from './20260322_legal_categories';
import * as migration_20260327_judges from './20260327_judges';
import * as migration_20260428_chat_feedback from './20260428_chat_feedback';
import * as migration_20260514_080000_user_action_collections from './20260514_080000_user_action_collections';
import * as migration_20260520_120000_bankruptcy_filings from './20260520_120000_bankruptcy_filings';
import * as migration_20260520_180000_bankruptcy_filings_published_at from './20260520_180000_bankruptcy_filings_published_at';
import * as migration_20260520_200000_admin_courts_and_departments from './20260520_200000_admin_courts_and_departments';
import * as migration_20260520_210000_bankruptcy_debtors from './20260520_210000_bankruptcy_debtors';
import * as migration_20260520_220000_experts_interpreters_fields from './20260520_220000_experts_interpreters_fields';
import * as migration_20260520_240000_user_legal_entity from './20260520_240000_user_legal_entity';
import * as migration_20260522_100000_judges_dashboard_fields from './20260522_100000_judges_dashboard_fields';
import * as migration_20260522_110000_attorneys from './20260522_110000_attorneys';
import * as migration_20260522_120000_decisions_analytics_fields from './20260522_120000_decisions_analytics_fields';

export const migrations = [
  {
    up: migration_20260321_191618.up,
    down: migration_20260321_191618.down,
    name: '20260321_191618',
  },
  {
    up: migration_20260321_enable_pg_trgm.up,
    down: migration_20260321_enable_pg_trgm.down,
    name: '20260321_enable_pg_trgm'
  },
  {
    up: migration_20260322_legal_categories.up,
    down: migration_20260322_legal_categories.down,
    name: '20260322_legal_categories',
  },
  {
    up: migration_20260327_judges.up,
    down: migration_20260327_judges.down,
    name: '20260327_judges',
  },
  {
    up: migration_20260428_chat_feedback.up,
    down: migration_20260428_chat_feedback.down,
    name: '20260428_chat_feedback',
  },
  {
    up: migration_20260514_080000_user_action_collections.up,
    down: migration_20260514_080000_user_action_collections.down,
    name: '20260514_080000_user_action_collections',
  },
  {
    up: migration_20260520_120000_bankruptcy_filings.up,
    down: migration_20260520_120000_bankruptcy_filings.down,
    name: '20260520_120000_bankruptcy_filings',
  },
  {
    up: migration_20260520_180000_bankruptcy_filings_published_at.up,
    down: migration_20260520_180000_bankruptcy_filings_published_at.down,
    name: '20260520_180000_bankruptcy_filings_published_at',
  },
  {
    up: migration_20260520_200000_admin_courts_and_departments.up,
    down: migration_20260520_200000_admin_courts_and_departments.down,
    name: '20260520_200000_admin_courts_and_departments',
  },
  {
    up: migration_20260520_210000_bankruptcy_debtors.up,
    down: migration_20260520_210000_bankruptcy_debtors.down,
    name: '20260520_210000_bankruptcy_debtors',
  },
  {
    up: migration_20260520_220000_experts_interpreters_fields.up,
    down: migration_20260520_220000_experts_interpreters_fields.down,
    name: '20260520_220000_experts_interpreters_fields',
  },
  {
    up: migration_20260520_240000_user_legal_entity.up,
    down: migration_20260520_240000_user_legal_entity.down,
    name: '20260520_240000_user_legal_entity',
  },
  {
    up: migration_20260522_100000_judges_dashboard_fields.up,
    down: migration_20260522_100000_judges_dashboard_fields.down,
    name: '20260522_100000_judges_dashboard_fields',
  },
  {
    up: migration_20260522_110000_attorneys.up,
    down: migration_20260522_110000_attorneys.down,
    name: '20260522_110000_attorneys',
  },
  {
    up: migration_20260522_120000_decisions_analytics_fields.up,
    down: migration_20260522_120000_decisions_analytics_fields.down,
    name: '20260522_120000_decisions_analytics_fields',
  },
];
