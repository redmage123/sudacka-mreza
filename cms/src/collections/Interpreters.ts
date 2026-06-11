import type { CollectionConfig } from 'payload'
import { generateSlug } from '../hooks/generateSlug.js'
import { isAdmin, isAdminOrEditor, publicRead, membersOnlyRead } from '../access.js'
import { COUNTY_OPTIONS, LANGUAGES } from '../data/croatia-taxonomy.js'
import { workingHoursField } from '../data/workingHoursField.js'

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
      name: 'languages',
      type: 'array',
      label: 'Jezici',
      admin: {
        description: 'Jezici za koje je tumač ovlašten (uz hrvatski).',
      },
      fields: [
        {
          name: 'language',
          type: 'select',
          required: true,
          label: 'Jezik',
          options: LANGUAGES.map((l) => ({ label: l.label, value: l.value })),
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
      type: 'select',
      label: 'Županija',
      options: [...COUNTY_OPTIONS],
    },
    {
      name: 'city',
      type: 'text',
      label: 'Grad',
      admin: {
        description: 'Grad/mjesto unutar odabrane županije.',
      },
    },
    workingHoursField(
      'workingHours',
      'Radno vrijeme',
      'Radno vrijeme za prijem stranaka po danima u tjednu.',
    ),
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
