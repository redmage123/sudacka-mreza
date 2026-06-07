import type { CollectionConfig } from 'payload'
import { generateSlug } from '../hooks/generateSlug.js'
import { isAdmin, isAdminOrEditor, publicRead } from '../access.js'

export const StateAttorneys: CollectionConfig = {
  slug: 'state-attorneys',
  admin: {
    group: 'Stručnjaci',
    description: 'Državna odvjetništva.',
    useAsTitle: 'name',
    defaultColumns: ['name', 'city', 'county'],
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
      label: 'Naziv',
    },
    {
      name: 'type',
      type: 'select',
      label: 'Vrsta odvjetništva',
      index: true,
      options: [
        { label: 'Općinsko državno odvjetništvo', value: 'municipal' },
        { label: 'Županijsko državno odvjetništvo', value: 'county' },
        { label: 'Državno odvjetništvo RH', value: 'state' },
        { label: 'Specijalno', value: 'special' },
      ],
    },
    {
      name: 'address',
      type: 'text',
      label: 'Adresa',
    },
    {
      name: 'city',
      type: 'text',
      required: true,
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
    },
    {
      name: 'fax',
      type: 'text',
      label: 'Fax',
    },
    {
      name: 'email',
      type: 'email',
      label: 'Email',
    },
    {
      name: 'lat',
      type: 'number',
      label: 'Geografska širina',
    },
    {
      name: 'lng',
      type: 'number',
      label: 'Geografska dužina',
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
