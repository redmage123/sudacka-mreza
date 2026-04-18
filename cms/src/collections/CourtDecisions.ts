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
