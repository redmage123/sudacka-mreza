import { buildConfig } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'

// Collections
import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Courts } from './collections/Courts'
import { CourtDecisions } from './collections/CourtDecisions'
import { ExpertWitnesses } from './collections/ExpertWitnesses'
import { Interpreters } from './collections/Interpreters'
import { StateAttorneys } from './collections/StateAttorneys'
import { BankruptcyAdministrators } from './collections/BankruptcyAdministrators'
import { BankruptcyListings } from './collections/BankruptcyListings'
import { Laws } from './collections/Laws'
import { NewsPosts } from './collections/NewsPosts'
import { Pages } from './collections/Pages'
import { Galleries } from './collections/Galleries'
import { Documents } from './collections/Documents'

// Globals
import { Settings } from './globals/Settings'
import { Navigation } from './globals/Navigation'

export default buildConfig({
  serverURL: process.env.SERVER_URL || 'http://localhost:4094',
  secret: process.env.PAYLOAD_SECRET || 'dev-secret-change-in-prod',

  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URI || 'postgresql://postgres:postgres@localhost:5432/sudacka_mreza',
    },
  }),

  editor: lexicalEditor({}),

  collections: [
    Users,
    Media,       // Media first — other collections reference it
    Courts,      // Courts second — Decisions, Experts, Interpreters, BankruptcyListings reference it
    CourtDecisions,
    ExpertWitnesses,
    Interpreters,
    StateAttorneys,
    BankruptcyAdministrators,
    BankruptcyListings,
    Laws,
    NewsPosts,
    Pages,
    Galleries,
    Documents,
  ],

  globals: [
    Settings,
    Navigation,
  ],

  cors: [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    'http://localhost:4093',
  ],

  csrf: [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    'http://localhost:4093',
  ],

  typescript: {
    outputFile: 'src/payload-types.ts',
  },

  admin: {
    user: 'users',
  },
})
