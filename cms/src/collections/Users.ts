import type { CollectionConfig } from 'payload'
import { isAdmin } from '../access.js'

export const Users: CollectionConfig = {
  slug: 'users',
  auth: true,
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'firstName', 'lastName', 'role'],
  },
  access: {
    // Anyone can register; role is forced to 'member' via beforeChange hook
    create: () => true,
    read: ({ req }) => {
      if (!req.user) return false
      if (req.user.role === 'admin') return true
      return { id: { equals: req.user.id } }
    },
    update: ({ req }) => {
      if (!req.user) return false
      if (req.user.role === 'admin') return true
      return { id: { equals: req.user.id } }
    },
    delete: isAdmin,
  },
  hooks: {
    beforeChange: [
      ({ data, req, operation }) => {
        // Force member role on self-registration
        if (operation === 'create' && req.user?.role !== 'admin') {
          data!.role = 'member'
        }
        // Prevent non-admins from escalating their own role
        if (operation === 'update' && req.user?.role !== 'admin') {
          delete data!.role
        }
        return data
      },
    ],
  },
  fields: [
    {
      name: 'firstName',
      type: 'text',
      required: true,
      label: 'Ime',
    },
    {
      name: 'lastName',
      type: 'text',
      required: true,
      label: 'Prezime',
    },
    {
      name: 'role',
      type: 'select',
      defaultValue: 'member',
      required: true,
      label: 'Uloga',
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'Urednik', value: 'editor' },
        { label: 'Član', value: 'member' },
      ],
      access: {
        // Only admins can set or change role
        update: ({ req }) => req.user?.role === 'admin',
      },
    },
  ],
}
