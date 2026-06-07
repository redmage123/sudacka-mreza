import type { CollectionConfig } from 'payload'
import { generateSlug } from '../hooks/generateSlug.js'
import { isAdmin, isAdminOrEditor, publicRead } from '../access.js'

export const Laws: CollectionConfig = {
  slug: 'laws',
  admin: {
    group: 'Sadržaj',
    description: 'Zakoni i propisi koji se referenciraju u sustavu.',
    useAsTitle: 'title',
    defaultColumns: ['title', 'type', 'year', 'category', 'lang'],
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
      label: 'Naziv zakona',
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      label: 'Vrsta propisa',
      options: [
        { label: 'Zakon', value: 'zakon' },
        { label: 'Pravilnik', value: 'pravilnik' },
        { label: 'Uredba', value: 'uredba' },
        { label: 'Odluka', value: 'odluka' },
        { label: 'Europski propis', value: 'europski' },
      ],
    },
    {
      name: 'year',
      type: 'number',
      label: 'Godina',
      admin: {
        description: 'Godina donošenja ili zadnje izmjene',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      label: 'Opis',
    },
    {
      name: 'fullText',
      type: 'richText',
      label: 'Puni tekst zakona',
      admin: {
        description: 'Puni tekst propisa (ako nije samo PDF)',
      },
    },
    {
      name: 'file',
      type: 'relationship',
      relationTo: 'media',
      label: 'PDF datoteka',
    },
    {
      name: 'externalUrl',
      type: 'text',
      label: 'Vanjski URL',
      admin: {
        description: 'Link na Narodne novine ili drugi izvor',
      },
    },
    {
      name: 'effectiveDate',
      type: 'date',
      label: 'Datum stupanja na snagu',
    },
    {
      name: 'supersededBy',
      type: 'relationship',
      relationTo: 'laws',
      label: 'Zamijenjen zakonom',
      admin: {
        description: 'Noviji propis koji je zamijenio ovaj (za starije verzije/novele)',
      },
    },
    {
      name: 'category',
      type: 'text',
      label: 'Kategorija',
      admin: {
        description: 'npr. Stečajno pravo, Kazneno pravo',
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
