import type { CollectionConfig } from 'payload'
import { generateSlug } from '../hooks/generateSlug.js'
import { isAdmin, isAdminOrEditor, publicRead } from '../access.js'

export const Judges: CollectionConfig = {
  slug: 'judges',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'court', 'specialization', 'status', 'lang'],
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
      name: 'court',
      type: 'relationship',
      relationTo: 'courts',
      label: 'Sud',
      admin: {
        description: 'Primarni sud kojemu je sudac dodijeljen',
      },
    },
    {
      name: 'appointmentDate',
      type: 'date',
      label: 'Datum imenovanja',
      admin: {
        description: 'Datum od kada je sudac raspoređen na ovaj sud (datum_od iz sudac_suda)',
        position: 'sidebar',
      },
    },
    {
      name: 'specialization',
      type: 'text',
      label: 'Specijalizacija / Odjel',
      admin: {
        description: 'Odjel ili specijalizacija suda (odjel1 iz sudac_suda)',
      },
    },
    {
      name: 'status',
      type: 'select',
      label: 'Status',
      defaultValue: 'active',
      options: [
        { label: 'Aktivan', value: 'active' },
        { label: 'Neaktivan', value: 'inactive' },
      ],
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'email',
      type: 'email',
      label: 'Email',
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
        { label: 'Srpski', value: 'sr' },
        { label: 'Makedonski', value: 'mk' },
      ],
      admin: {
        position: 'sidebar',
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
