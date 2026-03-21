import type { CollectionConfig } from 'payload'
import { generateSlug } from '../hooks/generateSlug.js'
import { isAdmin, isAdminOrEditor, publicRead } from '../access.js'

export const Pages: CollectionConfig = {
  slug: 'pages',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', 'lang'],
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
      label: 'Naslov',
    },
    {
      name: 'content',
      type: 'richText',
      required: true,
      label: 'Sadržaj',
    },
    {
      name: 'metaTitle',
      type: 'text',
      label: 'SEO naslov',
      admin: {
        description: 'Maks. 70 znakova. Ako je prazno, koristi se Naslov.',
      },
    },
    {
      name: 'metaDescription',
      type: 'textarea',
      label: 'SEO opis',
      admin: {
        description: 'Maks. 160 znakova.',
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
        description: 'Mapira na URL path segment (automatski generiran)',
      },
    },
  ],
}
