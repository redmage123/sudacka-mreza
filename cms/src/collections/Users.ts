import type { CollectionConfig } from 'payload'
import { isAdmin } from '../access.js'

export const Users: CollectionConfig = {
  slug: 'users',
  auth: {
    // SECURITY: require email verification before the account is usable
    verify: {
      generateEmailHTML: ({ token, user }) => {
        const url = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify?token=${token}`
        return `
          <h1>Potvrdite svoju e-mail adresu</h1>
          <p>Poštovani/a ${(user as any).firstName || ''},</p>
          <p>Molimo potvrdite svoju e-mail adresu klikom na poveznicu:</p>
          <a href="${url}">${url}</a>
          <p>Sudačka Mreža</p>
        `
      },
      generateEmailSubject: () => 'Sudačka Mreža — Potvrdite e-mail adresu',
    },
    maxLoginAttempts: 5,
    lockTime: 15 * 60 * 1000, // 15 minute lockout after 5 failed attempts
  },
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
      name: 'profile',
      type: 'group',
      label: 'Profil',
      fields: [
        {
          name: 'bio',
          type: 'textarea',
          label: 'Kratka biografija',
        },
        {
          name: 'phone',
          type: 'text',
          label: 'Telefon',
        },
        {
          name: 'organisation',
          type: 'text',
          label: 'Organizacija / Sud',
        },
      ],
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
