import type { CollectionConfig } from 'payload'
import { generateSlug } from '../hooks/generateSlug.js'
import { isAdmin, isAdminOrEditor, publicRead, membersOnlyRead } from '../access.js'

/**
 * Attorneys directory (odvjetnici). Backs the mockup §3.5 ("Odvjetnici u
 * sporu") which lists per-judge plaintiff/defendant counsel and their
 * win rates. The collection mirrors ExpertWitnesses for consistency
 * (legacy `odvjetnici` table is the seed; backfill script populates
 * canonical ime0/prezime0 and stashes ime1..9/prezime1..9 aliases).
 */
export const Attorneys: CollectionConfig = {
  slug: 'attorneys',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'firm', 'city', 'county', 'verified', 'lang'],
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
      name: 'firstName',
      type: 'text',
      label: 'Ime',
    },
    {
      name: 'lastName',
      type: 'text',
      label: 'Prezime',
    },
    {
      name: 'aliases',
      type: 'array',
      label: 'Alternativni zapisi imena',
      admin: {
        description: 'Povijesni / alternativni oblici imena iz legacy odvjetnici tablice (ime1..9 / prezime1..9).',
      },
      fields: [
        {
          name: 'fullName',
          type: 'text',
          required: true,
        },
      ],
    },
    {
      name: 'oib',
      type: 'text',
      label: 'OIB',
    },
    {
      name: 'photo',
      type: 'upload',
      relationTo: 'media',
      label: 'Fotografija',
    },
    {
      name: 'firm',
      type: 'text',
      label: 'Odvjetničko društvo',
      admin: {
        description: 'Naziv odvjetničke kancelarije ili društva (iz legacy odvjetnistva).',
      },
    },
    {
      name: 'barChamber',
      type: 'select',
      label: 'Komora',
      defaultValue: 'hok',
      options: [
        { label: 'Hrvatska odvjetnička komora (HOK)', value: 'hok' },
        { label: 'Druga komora', value: 'other' },
      ],
    },
    {
      name: 'department',
      type: 'select',
      label: 'Specijalizacija',
      admin: {
        description: 'Predmetna specijalizacija — usklađeno s judges.department i decisionType.',
      },
      options: [
        { label: 'Građansko', value: 'civil' },
        { label: 'Kazneno', value: 'criminal' },
        { label: 'Trgovačko', value: 'commercial' },
        { label: 'Upravno', value: 'administrative' },
        { label: 'Ustavno', value: 'constitutional' },
        { label: 'Prekršajno', value: 'misdemeanor' },
        { label: 'Obiteljsko', value: 'family' },
        { label: 'Radno', value: 'labour' },
        { label: 'Ostalo', value: 'other' },
      ],
    },
    {
      name: 'cv',
      type: 'relationship',
      relationTo: 'media',
      label: 'Životopis (CV)',
    },
    {
      name: 'address',
      type: 'text',
      label: 'Adresa',
    },
    {
      name: 'city',
      type: 'text',
      label: 'Grad',
    },
    {
      name: 'county',
      type: 'text',
      label: 'Županija',
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
      name: 'website',
      type: 'text',
      label: 'Web stranica',
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
      name: 'legacyId',
      type: 'number',
      label: 'Legacy ID (odvjetnici.id)',
      index: true,
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'ID iz legacy odvjetnici tablice — koristi se za idempotentni backfill.',
      },
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
