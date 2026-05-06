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
    // Allow logging in with a short username (e.g. "gordan") alongside email.
    // The MFA router relays to Payload's /api/users/login and forwards both
    // the `email` and `username` fields, so this config is required for the
    // username path to resolve.
    loginWithUsername: {
      allowEmailLogin: true,
      requireEmail: true,
      requireUsername: false,
    },
  },
  admin: {
    group: 'Korisnici',
    description: 'Registrirani korisnici i administratori. Email i 2FA enrolment.',
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

    // ── Email-based two-factor authentication (admins only) ───────────────
    //
    // On every admin login the MFA router (cms/src/routes/mfa.ts) generates a
    // 6-digit one-time code, stores its SHA-256 hash + 10-minute expiry, and
    // emails the plain code to the registered address. The legacy TOTP
    // columns below are retained for rollback only — no longer referenced
    // by the active login flow.
    { name: 'emailOtpHash', type: 'text', label: 'Email OTP hash', admin: { hidden: true } },
    { name: 'emailOtpExpiresAt', type: 'date', label: 'Email OTP expires', admin: { hidden: true } },
    { name: 'emailOtpAttempts', type: 'number', defaultValue: 0, label: 'Email OTP attempts', admin: { hidden: true } },

    // Legacy TOTP columns retained for rollback; no longer written to.
    { name: 'totpSecret', type: 'text', label: 'TOTP secret (legacy)', admin: { hidden: true } },
    { name: 'totpEnabled', type: 'checkbox', defaultValue: false, label: 'TOTP enabled (legacy)' },
    { name: 'totpEnrolledAt', type: 'date', label: 'TOTP enrolled at (legacy)', admin: { readOnly: true } },
    {
      name: 'totpRecoveryCodes',
      type: 'json',
      label: 'TOTP recovery codes (legacy, hashed)',
      admin: { readOnly: true, description: 'No longer used — retained for rollback.' },
    },
  ],
}
