import type { CollectionConfig } from 'payload'
import { isAdmin, isAdminOrEditor, publicRead } from '../access.js'

export const BankruptcyListings: CollectionConfig = {
  slug: 'bankruptcy-listings',
  admin: {
    group: 'Stečaj',
    description: 'Aktivni stečajni postupci s rokovima i kontaktima.',
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
      label: 'Dužnik (naziv)',
      admin: {
        description: 'Naziv stečajnog dužnika. Zadržano radi povratne kompatibilnosti — preferirajte vezu prema `debtor` zapisu kada postoji.',
      },
    },
    {
      name: 'debtor',
      type: 'relationship',
      relationTo: 'bankruptcy-debtors',
      label: 'Stečajni dužnik',
      admin: {
        description: 'Veza prema zapisu dužnika s OIB-om, adresom i poviješću postupaka.',
      },
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
      label: 'Imovina (opis)',
      admin: {
        description: 'Detaljan opis imovine u stečajnom postupku.',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      label: 'Opis (za pretragu)',
      index: true,
      admin: {
        description: 'Sažeti opis postupka za fulltext pretragu (npr. lokacija, ključne riječi). Drazenov "Pretraži u tekstu" filter pretražuje ovo polje + caseNumber + debtorName.',
      },
    },
    {
      name: 'assetCategory',
      type: 'select',
      label: 'Kategorija imovine',
      index: true,
      options: [
        { label: 'Nekretnine', value: 'immovable' },
        { label: 'Pokretnine', value: 'movable' },
        { label: 'Prava', value: 'rights' },
        { label: 'Mješovito', value: 'mixed' },
      ],
      admin: {
        description: 'Glavna kategorija imovine u stečajnom postupku.',
      },
    },
    {
      name: 'assetType',
      type: 'text',
      label: 'Vrsta imovine',
      index: true,
      admin: {
        description: 'Konkretna vrsta imovine (npr. stan, kuća, poslovni prostor, vozilo).',
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
    {
      name: 'contactEmail',
      type: 'email',
      label: 'Kontakt email',
      admin: {
        description: 'Javni kontakt email za pitanja o stečajnom postupku',
      },
    },
    {
      name: 'contactPhone',
      type: 'text',
      label: 'Kontakt telefon',
      admin: {
        description: 'Javni kontakt telefon za pitanja o stečajnom postupku',
      },
    },
  ],
}
