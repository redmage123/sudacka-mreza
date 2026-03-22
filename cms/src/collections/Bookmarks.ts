import type { CollectionConfig } from 'payload'

/** Access constraint: only the record owner can read/write */
const ownerOnly = ({ req }: Parameters<NonNullable<CollectionConfig['access']>['read']>[0]) => {
  if (!req.user) return false
  return { user: { equals: req.user.id } }
}

export const Bookmarks: CollectionConfig = {
  slug: 'bookmarks',
  admin: {
    useAsTitle: 'folder',
    defaultColumns: ['user', 'decision', 'folder', 'created_at'],
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
      name: 'folder',
      type: 'text',
      label: 'Mapa',
      defaultValue: 'Opće',
      admin: {
        description: 'npr. "Kazneni predmeti", "Građansko pravo", "Ustavno pravo"',
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
