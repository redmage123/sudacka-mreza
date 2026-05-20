import type { CollectionConfig } from 'payload'
import { generateSlug } from '../hooks/generateSlug.js'
import { isAdmin, isAdminOrEditor, publicRead } from '../access.js'

/**
 * Corrections-doc item 1 — each bankruptcy debtor (dužnik) needs its own
 * profile with all linked cases visible in one place. Listings stay
 * referencing the debtor by FK; this collection owns the long-lived
 * debtor entity (OIB, address, contact, notes).
 */
export const BankruptcyDebtors: CollectionConfig = {
  slug: 'bankruptcy-debtors',
  admin: {
    group: 'Stečaj',
    description: 'Stečajni dužnici (pravne ili fizičke osobe nad kojima se vodi stečajni postupak).',
    useAsTitle: 'name',
    defaultColumns: ['name', 'oib', 'city', 'county'],
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
      label: 'Naziv / Ime dužnika',
    },
    {
      name: 'oib',
      type: 'text',
      label: 'OIB',
      admin: {
        description: '11-znamenkasti OIB dužnika.',
      },
    },
    {
      name: 'address',
      type: 'text',
      label: 'Adresa',
    },
    {
      name: 'city',
      type: 'text',
      label: 'Grad',
    },
    {
      name: 'county',
      type: 'text',
      label: 'Županija',
    },
    {
      name: 'phone',
      type: 'text',
      label: 'Telefon',
    },
    {
      name: 'email',
      type: 'email',
      label: 'Email',
    },
    {
      name: 'notes',
      type: 'textarea',
      label: 'Bilješke',
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
