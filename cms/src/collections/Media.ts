import type { CollectionConfig } from 'payload'
import { isAdmin, isAdminOrEditor, publicRead } from '../access.js'

export const Media: CollectionConfig = {
  slug: 'media',
  upload: {
    staticDir: '../uploads',
    imageSizes: [
      { name: 'thumb', width: 400, height: 300, crop: 'center' },
      { name: 'card', width: 800, height: 600, crop: 'center' },
      { name: 'hero', width: 1440, height: 600, crop: 'center' },
    ],
    adminThumbnail: 'thumb',
    mimeTypes: [
      'image/*',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'audio/*',
      'video/mp4',
    ],
  },
  admin: {
    useAsTitle: 'filename',
    defaultColumns: ['filename', 'mimeType', 'filesize'],
  },
  access: {
    read: publicRead,
    create: isAdminOrEditor,
    update: isAdminOrEditor,
    delete: isAdmin,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      label: 'Alt tekst',
      admin: {
        description: 'Opis za pristupačnost (obavezno za slike)',
      },
    },
    {
      name: 'caption',
      type: 'textarea',
      label: 'Opis',
    },
  ],
}
