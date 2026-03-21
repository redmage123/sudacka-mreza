import type { CollectionConfig } from 'payload'
import { generateSlug } from '../hooks/generateSlug.js'
import { isAdmin, isAdminOrEditor, publicRead, membersOnlyRead } from '../access.js'

export const ExpertWitnesses: CollectionConfig = {
  slug: 'expert-witnesses',
  admin: {
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
          type: 'text',
          required: true,
          label: 'Područje',
        },
      ],
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
      name: 'county',
      type: 'text',
      label: 'Županija',
    },
    {
      name: 'city',
      type: 'text',
      label: 'Grad',
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
      type: 'text',
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
      },
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
