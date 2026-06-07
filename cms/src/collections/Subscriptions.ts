import { randomUUID } from 'crypto'
import type { CollectionConfig } from 'payload'
import { isAdmin } from '../access.js'

export const Subscriptions: CollectionConfig = {
  slug: 'subscriptions',
  admin: {
    group: 'Korisnici',
    description: 'Pretplate korisnika na obavijesti i newslettere.',
    useAsTitle: 'email',
    defaultColumns: ['email', 'subscription_type', 'frequency', 'confirmed', 'lastNotifiedAt'],
  },
  access: {
    read: isAdmin,
    create: () => true,
    update: isAdmin,
    delete: isAdmin,
  },
  hooks: {
    beforeChange: [
      ({ data, operation }) => {
        if (operation === 'create' && !data.token) {
          data.token = randomUUID()
        }
        return data
      },
    ],
  },
  fields: [
    {
      name: 'email',
      type: 'text',
      required: true,
      label: 'E-mail adresa',
    },
    {
      name: 'subscription_type',
      type: 'select',
      required: true,
      label: 'Vrsta pretplate',
      options: [
        { label: 'Sudska praksa', value: 'decisions' },
        { label: 'Vijesti', value: 'news' },
        { label: 'Vještaci i tumači', value: 'experts' },
      ],
    },
    {
      name: 'filters',
      type: 'group',
      label: 'Filteri',
      admin: {
        condition: (data) => data.subscription_type === 'decisions',
      },
      fields: [
        {
          name: 'court',
          type: 'text',
          label: 'Sud (naziv)',
        },
        {
          name: 'category',
          type: 'text',
          label: 'Vrsta odluke (vrijednost)',
        },
        {
          name: 'keyword',
          type: 'text',
          label: 'Ključna riječ',
        },
      ],
    },
    {
      name: 'frequency',
      type: 'select',
      required: true,
      defaultValue: 'daily',
      label: 'Učestalost',
      options: [
        { label: 'Dnevno', value: 'daily' },
        { label: 'Tjedno', value: 'weekly' },
      ],
    },
    {
      name: 'confirmed',
      type: 'checkbox',
      defaultValue: false,
      label: 'Potvrđena pretplata',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'token',
      type: 'text',
      label: 'Token za odjavu',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'lastNotifiedAt',
      type: 'date',
      label: 'Zadnje slanje',
      admin: {
        readOnly: true,
      },
    },
  ],
}
