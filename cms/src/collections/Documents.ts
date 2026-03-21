import type { CollectionConfig } from 'payload'
import { generateSlug } from '../hooks/generateSlug.js'
import { isAdmin, isAdminOrEditor, publicRead } from '../access.js'

export const Documents: CollectionConfig = {
  slug: 'documents',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'category', 'lang'],
  },
  access: {
    read: publicRead,
    create: isAdminOrEditor,
    update: isAdminOrEditor,
    delete: isAdmin,
  },
  hooks: {
    beforeChange: [generateSlug('title')],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      label: 'Naziv',
    },
    {
      name: 'category',
      type: 'text',
      required: true,
      label: 'Kategorija',
      admin: {
        description: 'npr. Obrasci, Tarife, Pravilnici',
      },
    },
    {
      name: 'file',
      type: 'relationship',
      relationTo: 'media',
      required: true,
      label: 'Datoteka',
    },
    {
      name: 'description',
      type: 'textarea',
      label: 'Opis',
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
