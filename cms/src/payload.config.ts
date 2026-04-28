import { buildConfig } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'

// Collections
import { Users } from './collections/Users.js'
import { Media } from './collections/Media.js'
import { Courts } from './collections/Courts.js'
import { CourtDecisions } from './collections/CourtDecisions.js'
import { ExpertWitnesses } from './collections/ExpertWitnesses.js'
import { Interpreters } from './collections/Interpreters.js'
import { StateAttorneys } from './collections/StateAttorneys.js'
import { BankruptcyAdministrators } from './collections/BankruptcyAdministrators.js'
import { BankruptcyListings } from './collections/BankruptcyListings.js'
import { Laws } from './collections/Laws.js'
import { NewsPosts } from './collections/NewsPosts.js'
import { Pages } from './collections/Pages.js'
import { Galleries } from './collections/Galleries.js'
import { Documents } from './collections/Documents.js'
import { LegalCategories } from './collections/LegalCategories.js'
import { Subscriptions } from './collections/Subscriptions.js'
import { Annotations } from './collections/Annotations.js'
import { Bookmarks } from './collections/Bookmarks.js'
import { ChatFeedback } from './collections/ChatFeedback.js'
import { ApiKeys } from './collections/ApiKeys.js'
import { Judges } from './collections/Judges.js'

// Globals
import { Settings } from './globals/Settings.js'
import { Navigation } from './globals/Navigation.js'

// Endpoints
import { flagHandler, verifyHandler } from './endpoints/expertFlag.js'

export default buildConfig({
  serverURL: process.env.SERVER_URL || 'http://localhost:4094',
  secret: process.env.PAYLOAD_SECRET || 'dev-secret-change-in-prod',

  // E2-16: Payload localization — enables ?locale=hr|en on all REST endpoints.
  // Content collections use a manual 'lang' select field for record-level language
  // separation; this config activates Payload's built-in locale query parameter
  // support and the localized flag on individual fields where bilingual storage
  // is preferred over duplicate documents.
  localization: {
    locales: [
      { label: 'Hrvatski', code: 'hr' },
      { label: 'English', code: 'en' },
    ],
    defaultLocale: 'hr',
    fallback: true,
  },

  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URI || 'postgresql://postgres:postgres@localhost:5432/sudacka_mreza',
    },
    migrationDir: process.env.PAYLOAD_MIGRATIONS_DIR || 'src/migrations',
  }),

  editor: lexicalEditor({}),

  // E2-18: Global upload configuration — max 50 MB, local storage in cms/uploads/
  upload: {
    limits: {
      fileSize: 50 * 1024 * 1024, // 50 MB
    },
  },

  collections: [
    Users,
    Media,       // Media first — other collections reference it
    Courts,          // Courts second — Decisions, Experts, Interpreters, BankruptcyListings reference it
    LegalCategories, // Taxonomy — registered before CourtDecisions which references it
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
    Subscriptions,
    Annotations,
    Bookmarks,
    ApiKeys,
    Judges,
    ChatFeedback,
  ],

  globals: [
    Settings,
    Navigation,
  ],

  endpoints: [
    {
      path: '/experts/:id/flag',
      method: 'post',
      handler: flagHandler('expert-witnesses'),
    },
    {
      path: '/experts/:id/verify',
      method: 'post',
      handler: verifyHandler('expert-witnesses'),
    },
    {
      path: '/interpreters/:id/flag',
      method: 'post',
      handler: flagHandler('interpreters'),
    },
    {
      path: '/interpreters/:id/verify',
      method: 'post',
      handler: verifyHandler('interpreters'),
    },
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
