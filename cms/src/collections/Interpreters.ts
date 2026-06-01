import type { CollectionConfig } from 'payload'
import { generateSlug } from '../hooks/generateSlug.js'
import { isAdmin, isAdminOrEditor, publicRead, membersOnlyRead } from '../access.js'

export const Interpreters: CollectionConfig = {
  slug: 'interpreters',
  admin: {
    group: 'Stručnjaci',
    description: 'Sudski tumači po jezicima i županiji.',
    useAsTitle: 'name',
    defaultColumns: ['name', 'county', 'verified', 'lang'],
  },
  access: {
    read: publicRead,
    create: isAdminOrEditor,
    update: isAdminOrEditor,
    delete: isAdmin,
  },
  hooks: {
    beforeChange: [generateSlug('name')],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      label: 'Ime i prezime',
    },
    {
      // BCP-47 language pairs e.g. ['hr-en', 'hr-de']
      name: 'languagePairs',
      type: 'array',
      label: 'Jezični parovi',
      fields: [
        {
          name: 'pair',
          type: 'text',
          required: true,
          label: 'Par',
          admin: {
            description: 'BCP-47 par rastavljen crticom, npr. hr-en',
          },
        },
      ],
    },
    {
      name: 'address',
      type: 'text',
      label: 'Adresa',
    },
    {
      name: 'county',
      type: 'text',
      label: 'Županija',
    },
    {
      name: 'city',
      type: 'text',
      label: 'Grad',
    },
    {
      name: 'company',
      type: 'text',
      label: 'Tvrtka / Firm',
      admin: {
        description: 'Naziv tvrtke / poduzeća kojem tumač pripada (opcionalno).',
      },
    },
    {
      name: 'cv',
      type: 'relationship',
      relationTo: 'media',
      label: 'Životopis (CV)',
    },
    {
      name: 'works',
      type: 'relationship',
      relationTo: 'media',
      hasMany: true,
      label: 'Priloženi radovi',
    },
    {
      name: 'phone',
      type: 'text',
      label: 'Telefon',
      access: {
        read: membersOnlyRead,
      },
    },
    {
      name: 'email',
      type: 'email',
      label: 'Email',
      access: {
        read: membersOnlyRead,
      },
    },
    {
      name: 'verified',
      type: 'checkbox',
      defaultValue: false,
      label: 'Verificiran',
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'verifiedAt',
      type: 'date',
      label: 'Datum verifikacije',
      admin: {
        position: 'sidebar',
        condition: (data) => Boolean(data?.verified),
      },
    },
    {
      name: 'verifiedBy',
      type: 'relationship',
      relationTo: 'users',
      label: 'Verificirao',
      admin: {
        position: 'sidebar',
        condition: (data) => Boolean(data?.verified),
      },
    },
    {
      name: 'lastConfirmed',
      type: 'date',
      label: 'Posljednja potvrda',
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'flagReports',
      type: 'array',
      label: 'Prijave netočnih podataka',
      access: {
        read: ({ req }) => req.user?.role === 'admin' || req.user?.role === 'editor',
      },
      admin: {
        readOnly: true,
      },
      fields: [
        {
          name: 'reporter',
          type: 'relationship',
          relationTo: 'users',
          label: 'Prijavitelj',
        },
        {
          name: 'reason',
          type: 'textarea',
          label: 'Razlog',
        },
        {
          name: 'date',
          type: 'date',
          label: 'Datum',
        },
      ],
    },
    {
      name: 'assignedCourts',
      type: 'relationship',
      relationTo: 'courts',
      hasMany: true,
      label: 'Dodijeljeni sudovi',
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
        { label: 'Deutsch', value: 'de' },
        { label: 'Français', value: 'fr' },
        { label: 'Български', value: 'bg' },
        { label: 'Čeština', value: 'cs' },
        { label: 'Dansk', value: 'da' },
        { label: 'Ελληνικά', value: 'el' },
        { label: 'Español', value: 'es' },
        { label: 'Eesti', value: 'et' },
        { label: 'Euskara', value: 'eu' },
        { label: 'Suomi', value: 'fi' },
        { label: 'Gaeilge', value: 'ga' },
        { label: 'Magyar', value: 'hu' },
        { label: 'Íslenska', value: 'is' },
        { label: 'Italiano', value: 'it' },
        { label: '日本語', value: 'ja' },
        { label: 'Lietuvių', value: 'lt' },
        { label: 'Latviešu', value: 'lv' },
        { label: 'Malti', value: 'mt' },
        { label: 'Norsk bokmål', value: 'nb' },
        { label: 'Nederlands', value: 'nl' },
        { label: 'Polski', value: 'pl' },
        { label: 'Português', value: 'pt' },
        { label: 'Română', value: 'ro' },
        { label: 'Slovenčina', value: 'sk' },
        { label: 'Slovenščina', value: 'sl' },
        { label: 'Svenska', value: 'sv' },
        { label: 'Українська', value: 'uk' },
        { label: 'العربية', value: 'ar' },
        { label: '中文', value: 'zh' },
      ],
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
