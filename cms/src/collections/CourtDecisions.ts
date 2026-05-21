import type { CollectionConfig } from 'payload'
import { generateSlug } from '../hooks/generateSlug.js'
import { generateSearchIndex } from '../hooks/generateSearchIndex.js'
import { ingestToRag } from '../hooks/ingestToRag.js'
import { citationLinker } from '../hooks/citationLinker.js'
import { isAdmin, isAdminOrEditor, publicRead } from '../access.js'

export const CourtDecisions: CollectionConfig = {
  slug: 'court-decisions',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'court', 'decisionType', 'date', 'lang'],
  },
  access: {
    read: publicRead,
    create: isAdminOrEditor,
    update: isAdminOrEditor,
    delete: isAdmin,
  },
  hooks: {
    beforeChange: [generateSlug('title')],
    afterChange: [generateSearchIndex, citationLinker, ingestToRag],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      label: 'Naslov odluke',
    },
    {
      name: 'court',
      type: 'relationship',
      relationTo: 'courts',
      required: true,
      label: 'Sud',
    },
    {
      name: 'decisionType',
      type: 'select',
      required: true,
      label: 'Vrsta odluke',
      options: [
        { label: 'Građansko', value: 'civil' },
        { label: 'Kazneno', value: 'criminal' },
        { label: 'Trgovačko', value: 'commercial' },
        { label: 'Upravno', value: 'administrative' },
        { label: 'Ustavno', value: 'constitutional' },
        { label: 'Europski sud pravde (ECJ)', value: 'ecj' },
        { label: 'Europski sud za ljudska prava (ECtHR)', value: 'ecthr' },
      ],
    },
    {
      name: 'date',
      type: 'date',
      required: true,
      label: 'Datum odluke',
    },
    {
      name: 'caseNumber',
      type: 'text',
      required: true,
      label: 'Broj predmeta',
      admin: {
        description: 'npr. Gž-1234/2024',
      },
    },
    {
      name: 'fullText',
      type: 'richText',
      label: 'Puni tekst',
    },
    {
      // Auto-populated from fullText by generateSearchIndex hook; used for PostgreSQL FTS
      name: 'fullTextPlain',
      type: 'textarea',
      label: 'Puni tekst (ravni)',
      admin: {
        hidden: true,
        description: 'Auto-populated from fullText for full-text search indexing',
      },
    },
    {
      name: 'summary',
      type: 'textarea',
      label: 'Sažetak',
      admin: {
        description: 'Kratki sažetak odluke',
      },
    },
    {
      name: 'categories',
      type: 'relationship',
      relationTo: 'legal-categories',
      hasMany: true,
      label: 'Pravne kategorije',
      admin: {
        description: 'Pravna područja kojima ova odluka pripada',
      },
    },
    {
      name: 'category',
      type: 'text',
      label: 'Kategorija',
      admin: {
        description: 'Zastarjelo — koristite polje "Pravne kategorije" umjesto ovog',
      },
    },
    {
      name: 'tags',
      type: 'array',
      label: 'Oznake',
      fields: [
        {
          name: 'tag',
          type: 'text',
          required: true,
        },
      ],
    },
    {
      name: 'lang',
      type: 'select',
      required: true,
      defaultValue: 'hr',
      label: 'Jezik',
      options: [
        { label: 'Hrvatski', value: 'hr' },
        { label: 'English', value: 'en' },
      ],
    },
    {
      name: 'attachments',
      type: 'relationship',
      relationTo: 'media',
      hasMany: true,
      label: 'Privitci',
    },
    {
      // Plain-text concatenation used as poor-man's FTS until pg tsvector trigger is active
      name: 'searchVector',
      type: 'text',
      index: true,
      admin: {
        hidden: true,
      },
    },
    {
      name: 'cited_decisions',
      type: 'relationship',
      relationTo: 'court-decisions',
      hasMany: true,
      label: 'Citirane odluke',
      admin: {
        description: 'Odluke na koje ova odluka upućuje (automatski detektirano iz teksta)',
        readOnly: true,
      },
    },
    {
      name: 'cited_by',
      type: 'relationship',
      relationTo: 'court-decisions',
      hasMany: true,
      label: 'Odluke koje citiraju ovu',
      admin: {
        description: 'Odluke koje upućuju na ovu odluku (automatski ažurirano)',
        readOnly: true,
      },
    },
    // ── Phase 1: judge-dashboard analytics fields ─────────────────────────
    // All fields are nullable so existing 12,830 rows stay valid. Backfill
    // happens via scripts/extract-decision-analytics.mjs (LLM pass over
    // full_text_plain) and scripts/extract-appeal-outcomes.mjs (cite-chase).
    {
      name: 'judges',
      type: 'relationship',
      relationTo: 'judges',
      hasMany: true,
      label: 'Suci u vijeću',
      admin: {
        description: 'Suci koji su odlučivali — auto-extrahiran iz teksta presude.',
      },
    },
    {
      name: 'expertWitnesses',
      type: 'relationship',
      relationTo: 'expert-witnesses',
      hasMany: true,
      label: 'Vještaci u predmetu',
    },
    {
      name: 'plaintiffAttorneys',
      type: 'relationship',
      relationTo: 'attorneys',
      hasMany: true,
      label: 'Odvjetnici tužitelja',
    },
    {
      name: 'defendantAttorneys',
      type: 'relationship',
      relationTo: 'attorneys',
      hasMany: true,
      label: 'Odvjetnici tuženika',
    },
    {
      name: 'appealOutcome',
      type: 'select',
      label: 'Ishod žalbe',
      admin: {
        description: 'Ispunjava se na prvostupanjskoj odluci kad je viša instanca odlučila — cite-chased.',
      },
      options: [
        { label: 'Potvrđena', value: 'upheld' },
        { label: 'Preinačena', value: 'modified' },
        { label: 'Ukinuta', value: 'overturned' },
        { label: 'Bez žalbe / nepoznato', value: 'na' },
      ],
    },
    {
      name: 'appealedDecision',
      type: 'relationship',
      relationTo: 'court-decisions',
      label: 'Drugostupanjska odluka',
      admin: {
        description: 'Veza na drugostupanjsku presudu koja je razmatrala ovu odluku.',
      },
    },
    {
      name: 'winningParty',
      type: 'select',
      label: 'Stranka u korist',
      admin: {
        description: 'Glavni ishod prvostupanjske odluke — extrahiran iz dispositiva.',
      },
      options: [
        { label: 'Tužitelj', value: 'plaintiff' },
        { label: 'Tuženik', value: 'defendant' },
        { label: 'Djelomično', value: 'partial' },
        { label: 'Nagodba', value: 'settled' },
        { label: 'Odbačen', value: 'dismissed' },
      ],
    },
    {
      name: 'appealFiled',
      type: 'checkbox',
      label: 'Pravni lijek izjavljen',
      defaultValue: false,
    },
    {
      name: 'appealType',
      type: 'select',
      label: 'Vrsta pravnog lijeka',
      options: [
        { label: 'Žalba', value: 'zalba' },
        { label: 'Revizija', value: 'revizija' },
        { label: 'Ustavna tužba', value: 'ustavnaTuzba' },
        { label: 'Ponavljanje postupka', value: 'ponavljanjePostupka' },
      ],
    },
    {
      name: 'caseDurationDays',
      type: 'number',
      label: 'Trajanje predmeta (dani)',
      admin: {
        description: 'Razlika datum_otvaranja → date — auto-extrahiran iz teksta.',
      },
    },
    {
      name: 'disputeType',
      type: 'select',
      label: 'Vrsta spora',
      options: [
        { label: 'Naknada štete', value: 'naknadaStete' },
        { label: 'Isplata', value: 'isplata' },
        { label: 'Vlasništvo', value: 'vlasnistvo' },
        { label: 'Razvod', value: 'razvod' },
        { label: 'Radni spor', value: 'radniSpor' },
        { label: 'Ugovorni', value: 'ugovorni' },
        { label: 'Nasljedstvo', value: 'nasljednistvo' },
        { label: 'Obiteljski', value: 'obiteljski' },
        { label: 'Kazneno djelo', value: 'kaznenoDjelo' },
        { label: 'Prekršaj', value: 'prekrsaj' },
        { label: 'Drugo', value: 'drugo' },
      ],
    },
    {
      name: 'disputeValue',
      type: 'number',
      label: 'Vrijednost spora',
      admin: {
        description: 'Novčani iznos spora u valuti `currency`.',
      },
    },
    {
      name: 'currency',
      type: 'select',
      label: 'Valuta',
      defaultValue: 'EUR',
      admin: {
        description: 'Predmeti prije 2023-01-01 mogu biti u HRK.',
      },
      options: [
        { label: 'EUR', value: 'EUR' },
        { label: 'HRK', value: 'HRK' },
        { label: 'USD', value: 'USD' },
      ],
    },
    {
      name: 'analyticsExtractedAt',
      type: 'date',
      label: 'Analitika ekstrahirana',
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'Kad je extract-decision-analytics zadnji put obradio ovu odluku.',
      },
    },
    {
      name: 'slug',
      type: 'text',
      unique: true,
      index: true,
      admin: {
        readOnly: true,
      },
    },
  ],
}
