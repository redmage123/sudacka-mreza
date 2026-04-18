import type { CollectionConfig } from 'payload'
import { generateSlug } from '../hooks/generateSlug.js'
import { isAdmin, isAdminOrEditor } from '../access.js'

export const Galleries: CollectionConfig = {
  slug: 'galleries',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'type', 'publishedAt', 'lang'],
  },
  access: {
    // Public sees only published galleries
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
      name: 'type',
      type: 'select',
      required: true,
      defaultValue: 'photo',
      label: 'Vrsta',
      options: [
        { label: 'Foto', value: 'photo' },
        { label: 'Video', value: 'video' },
        { label: 'Audio', value: 'audio' },
      ],
    },
    {
      name: 'description',
      type: 'textarea',
      label: 'Opis',
    },
    {
      name: 'items',
      type: 'array',
      label: 'Stavke',
      fields: [
        {
          name: 'media',
          type: 'relationship',
          relationTo: 'media',
          label: 'Medij (slika / audio datoteka)',
          admin: {
            description: 'Koristite za foto i audio galerije. Za video galerije koristite Video URL.',
          },
        },
        {
          name: 'videoUrl',
          type: 'text',
          label: 'Video URL (YouTube / Vimeo)',
          admin: {
            description: 'Embed URL za YouTube ili Vimeo (za video galerije)',
          },
        },
        {
          name: 'caption',
          type: 'text',
          label: 'Opis stavke',
        },
      ],
    },
    {
      name: 'publishedAt',
      type: 'date',
      label: 'Datum objave',
      admin: {
        description: 'Prazno = neobjavljeno',
        date: {
          pickerAppearance: 'dayAndTime',
        },
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
