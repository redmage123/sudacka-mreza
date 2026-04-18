import * as migration_20260321_191618 from './20260321_191618';
import * as migration_20260321_enable_pg_trgm from './20260321_enable_pg_trgm';
import * as migration_20260322_legal_categories from './20260322_legal_categories';
import * as migration_20260327_judges from './20260327_judges';

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
];
