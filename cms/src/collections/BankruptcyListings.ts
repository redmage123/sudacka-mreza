import type { CollectionConfig } from 'payload'
import { isAdmin, isAdminOrEditor, publicRead } from '../access.js'

export const BankruptcyListings: CollectionConfig = {
  slug: 'bankruptcy-listings',
  admin: {
    useAsTitle: 'caseNumber',
    defaultColumns: ['caseNumber', 'debtorName', 'court', 'status', 'deadline'],
  },
  access: {
    read: publicRead,
    create: isAdminOrEditor,
    update: isAdminOrEditor,
    delete: isAdmin,
  },
  fields: [
    {
      name: 'caseNumber',
      type: 'text',
      required: true,
      label: 'Broj predmeta',
    },
    {
      name: 'debtorName',
      type: 'text',
      required: true,
      label: 'Dužnik',
    },
    {
      name: 'court',
      type: 'relationship',
      relationTo: 'courts',
      required: true,
      label: 'Sud',
    },
    {
      name: 'administrator',
      type: 'relationship',
      relationTo: 'bankruptcy-administrators',
      label: 'Stečajni upravitelj',
    },
    {
      name: 'assets',
      type: 'richText',
      label: 'Imovina',
      admin: {
        description: 'Opis imovine u stečajnom postupku',
      },
    },
    {
      name: 'deadline',
      type: 'date',
      label: 'Rok (datum)',
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'active',
      label: 'Status',
      options: [
        { label: 'Aktivan', value: 'active' },
        { label: 'Dovršen', value: 'completed' },
        { label: 'Povučen', value: 'withdrawn' },
      ],
    },
    {
      name: 'publishedAt',
      type: 'date',
      label: 'Datum objave',
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    {
      name: 'attachments',
      type: 'relationship',
      relationTo: 'media',
      hasMany: true,
      label: 'Privitci',
    },
  ],
}
