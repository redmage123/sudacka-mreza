import type { CollectionConfig } from 'payload'
import { generateSlug } from '../hooks/generateSlug.js'
import { isAdmin, isAdminOrEditor, publicRead, membersOnlyRead } from '../access.js'
import {
  COUNTY_OPTIONS,
  EXPERT_AREA_OPTIONS,
  EDUCATION_LEVELS,
  EXPERT_TYPES,
} from '../data/croatia-taxonomy.js'
import { workingHoursField } from '../data/workingHoursField.js'

export const ExpertWitnesses: CollectionConfig = {
  slug: 'expert-witnesses',
  admin: {
    group: 'Stručnjaci',
    description: 'Sudski vještaci po struci i županiji.',
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
      name: 'specialityAreas',
      type: 'array',
      label: 'Područja vještačenja',
      fields: [
        {
          name: 'area',
          type: 'select',
          required: true,
          label: 'Grana djelatnosti',
          options: [...EXPERT_AREA_OPTIONS],
          admin: {
            description: 'Kategorija iz Imenika stalnih sudskih vještaka.',
          },
        },
        {
          name: 'subArea',
          type: 'text',
          label: 'Uža specijalizacija',
          admin: {
            description: 'Uža specijalizacija unutar grane (opcionalno, slobodan tekst).',
          },
        },
      ],
    },
    {
      name: 'expertType',
      type: 'select',
      label: 'Vrsta vještaka',
      options: EXPERT_TYPES.map((t) => ({ label: t.label, value: t.value })),
      admin: {
        description: 'Vrsta upisa u Imenik.',
      },
    },
    {
      name: 'educationLevel',
      type: 'select',
      label: 'Razina obrazovanja',
      options: EDUCATION_LEVELS.map((e) => ({ label: e.label, value: e.value })),
    },
    {
      name: 'languages',
      type: 'array',
      label: 'Jezici',
      fields: [
        {
          name: 'language',
          type: 'text',
          required: true,
          label: 'Jezik',
          admin: {
            description: 'BCP-47 kod, npr. hr, en, de',
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
        description: 'Naziv tvrtke / poduzeća kojem vještak pripada (opcionalno).',
      },
    },
    {
      name: 'cv',
      type: 'relationship',
      relationTo: 'media',
      label: 'Životopis (CV)',
      admin: {
        description: 'Prilog s životopisom.',
      },
    },
    {
      name: 'works',
      type: 'relationship',
      relationTo: 'media',
      hasMany: true,
      label: 'Priloženi radovi',
      admin: {
        description: 'Stručni radovi i druge javno dostupne publikacije.',
      },
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
        description: 'Admin-set verified badge prikazan na profilu',
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
      name: 'notes',
      type: 'richText',
      label: 'Bilješke / Biografija',
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
