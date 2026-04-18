import type { Access, CollectionConfig } from 'payload'

/** Access constraint: only the record owner can read/write */
const ownerOnly: Access = ({ req }) => {
  if (!req.user) return false
  return { user: { equals: req.user.id } }
}

export const Annotations: CollectionConfig = {
  slug: 'annotations',
  admin: {
    useAsTitle: 'note',
    defaultColumns: ['user', 'decision', 'highlight_color', 'created_at'],
  },
  access: {
    create: ({ req }) => Boolean(req.user),
    read: ownerOnly,
    update: ownerOnly,
    delete: ownerOnly,
  },
  hooks: {
    beforeChange: [
      ({ data, req, operation }) => {
        if (operation === 'create') {
          data!.user = req.user?.id
          data!.created_at = new Date().toISOString()
        }
        return data
      },
    ],
  },
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      label: 'Korisnik',
      admin: {
        readOnly: true,
        description: 'Auto-populated from the authenticated user on create',
      },
    },
    {
      name: 'decision',
      type: 'relationship',
      relationTo: 'court-decisions',
      required: true,
      label: 'Odluka',
    },
    {
      name: 'text_selection',
      type: 'group',
      label: 'Odabir teksta',
      fields: [
        {
          name: 'start',
          type: 'number',
          required: true,
          label: 'Početak (indeks znaka)',
          admin: {
            description: 'Zero-based character offset of the selection start within the decision plain text',
          },
        },
        {
          name: 'end',
          type: 'number',
          required: true,
          label: 'Kraj (indeks znaka)',
          admin: {
            description: 'Zero-based character offset of the selection end within the decision plain text',
          },
        },
      ],
    },
    {
      name: 'highlight_color',
      type: 'select',
      required: true,
      defaultValue: 'yellow',
      label: 'Boja isticanja',
      options: [
        { label: 'Žuta', value: 'yellow' },
        { label: 'Zelena', value: 'green' },
        { label: 'Plava', value: 'blue' },
        { label: 'Roza', value: 'pink' },
      ],
    },
    {
      name: 'note',
      type: 'textarea',
      label: 'Bilješka',
      admin: {
        description: 'Opcionalna bilješka uz istaknuti odlomak',
      },
    },
    {
      name: 'created_at',
      type: 'date',
      label: 'Stvoreno',
      admin: {
        readOnly: true,
        description: 'Auto-populated on create',
      },
    },
  ],
}
