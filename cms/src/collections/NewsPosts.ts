import type { CollectionConfig } from 'payload'
import { generateSlug } from '../hooks/generateSlug.js'
import { isAdmin, isAdminOrEditor } from '../access.js'

export const NewsPosts: CollectionConfig = {
  slug: 'news-posts',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'publishedAt', 'author', 'lang'],
  },
  access: {
    // Public sees only published posts (publishedAt set and not in the future)
    read: ({ req }) => {
      if (req.user?.role === 'admin' || req.user?.role === 'editor') return true
      return {
        and: [
          { publishedAt: { exists: true } },
          { publishedAt: { less_than_equal: new Date().toISOString() } },
        ],
      }
    },
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
      name: 'excerpt',
      type: 'textarea',
      label: 'Sažetak',
      admin: {
        description: 'Maks. 280 znakova. Koristi se na listingima i kao OG opis.',
      },
    },
    {
      name: 'featuredImage',
      type: 'relationship',
      relationTo: 'media',
      label: 'Naslovna slika',
    },
    {
      name: 'category',
      type: 'text',
      label: 'Kategorija',
    },
    {
      name: 'publishedAt',
      type: 'date',
      label: 'Datum objave',
      admin: {
        description: 'Prazno = skica (draft). Buduće datum = zakazano.',
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    {
      name: 'author',
      type: 'relationship',
      relationTo: 'users',
      label: 'Autor',
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
