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
    group: { hr: 'Korisnici', en: 'Users' },
    description: {
      hr: 'Registrirani korisnici i administratori. Email i upis dvostruke autentifikacije (2FA).',
      en: 'Registered users and administrators. Email and 2FA enrolment.',
    },
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
      ({ data, req, operation, originalDoc }) => {
        // QA #7: legal-entity self-registration. When the public RegisterPage
        // submits both organisationName + a well-formed 11-digit OIB, promote
        // the account to `legal_entity` so it can submit bankruptcy filings
        // (matches `isLegalEntityOrAbove` on BankruptcyFilings). Server-side
        // OIB digit-count check is the same one the form enforces — a real
        // mod-11 checksum is a future hardening step. All other self-creates
        // remain `member` (existing behaviour).
        if (operation === 'create' && req.user?.role !== 'admin') {
          const d = data as { organisationName?: string; organisationOib?: string; role?: string }
          const orgName = (d.organisationName || '').trim()
          const oib = (d.organisationOib || '').trim()
          if (orgName && /^\d{11}$/.test(oib)) {
            d.role = 'legal_entity'
          } else {
            d.role = 'member'
          }
        }
        // Prevent non-admins — and system-initiated updates that run with no
        // req.user at all (forgot-password, email verification, login-attempt
        // counters) — from changing `role`. PIN it to the stored value rather
        // than `delete`-ing it: `role` is required, and those internal updates
        // pass the whole document, so deleting the key makes validation fail
        // with "This field is required" and breaks the operation entirely.
        if (operation === 'update' && req.user?.role !== 'admin' && originalDoc) {
          (data as { role?: string }).role = (originalDoc as { role?: string }).role
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
      label: { hr: 'Uloga', en: 'Role' },
      options: [
        { label: { hr: 'Administrator', en: 'Admin' }, value: 'admin' },
        { label: { hr: 'Urednik', en: 'Editor' }, value: 'editor' },
        // Pravno lice — registrirana organizacija / odvjetničko društvo /
        // stečajni upravitelj koji djeluje u svoje ime. Može podnositi
        // stečajne podneske kao i urednici.
        { label: { hr: 'Pravno lice', en: 'Legal entity' }, value: 'legal_entity' },
        { label: { hr: 'Član', en: 'Member' }, value: 'member' },
      ],
      // NOTE: no field-level `access.update` here. Restricting it to admins
      // broke every UNAUTHENTICATED internal update Payload performs on a user
      // row — forgot-password, email verification, login-attempt counters —
      // with `ValidationError: ... Uloga`, because those run with no req.user.
      // Privilege escalation is already prevented by the beforeChange hook
      // above (`operation === 'update' && req.user?.role !== 'admin'` strips
      // `role` from the incoming data), which does it without breaking
      // system-initiated writes.
    },

    // ── Legal-entity profile (only shown when role=legal_entity) ─────────
    {
      name: 'organisationName',
      type: 'text',
      label: 'Naziv pravne osobe',
      admin: {
        description: 'Naziv tvrtke / odvjetničkog društva / udruge.',
        condition: (data) => (data as { role?: string })?.role === 'legal_entity',
      },
    },
    {
      name: 'organisationOib',
      type: 'text',
      label: 'OIB pravne osobe',
      admin: {
        description: '11-znamenkasti OIB pravne osobe.',
        condition: (data) => (data as { role?: string })?.role === 'legal_entity',
      },
    },

    // ── Email-based two-factor authentication (admins only) ───────────────
    //
    // On every admin login the MFA router (cms/src/routes/mfa.ts) generates a
    // 6-digit one-time code, stores its SHA-256 hash + 10-minute expiry, and
    // emails the plain code to the registered address. The legacy TOTP
    // columns below are retained for rollback only — no longer referenced
    // by the active login flow.
    { name: 'emailOtpHash', type: 'text', label: { hr: 'Email OTP hash', en: 'Email OTP hash' }, admin: { hidden: true } },
    { name: 'emailOtpExpiresAt', type: 'date', label: { hr: 'Email OTP istek', en: 'Email OTP expires' }, admin: { hidden: true } },
    { name: 'emailOtpAttempts', type: 'number', defaultValue: 0, label: { hr: 'Email OTP pokušaji', en: 'Email OTP attempts' }, admin: { hidden: true } },

    // Legacy TOTP columns retained for rollback; no longer written to.
    { name: 'totpSecret', type: 'text', label: { hr: 'TOTP tajna (zastarjelo)', en: 'TOTP secret (legacy)' }, admin: { hidden: true } },
    { name: 'totpEnabled', type: 'checkbox', defaultValue: false, label: { hr: 'TOTP omogućen (zastarjelo)', en: 'TOTP enabled (legacy)' } },
    { name: 'totpEnrolledAt', type: 'date', label: { hr: 'TOTP upisan (zastarjelo)', en: 'TOTP enrolled at (legacy)' }, admin: { readOnly: true } },
    {
      name: 'totpRecoveryCodes',
      type: 'json',
      label: { hr: 'TOTP kodovi za oporavak (zastarjelo, hash)', en: 'TOTP recovery codes (legacy, hashed)' },
      admin: {
        readOnly: true,
        description: {
          hr: 'Više se ne koristi — zadržano za eventualni vraćanja.',
          en: 'No longer used — retained for rollback.',
        },
      },
    },
  ],
}
