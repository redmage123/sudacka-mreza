import type { GlobalConfig } from 'payload'
import { isAdmin, publicRead } from '../access.js'

const navItemFields = [
  { name: 'labelHr', type: 'text' as const, required: true, label: 'Oznaka (HR)' },
  { name: 'labelEn', type: 'text' as const, label: 'Label (EN)' },
  { name: 'href', type: 'text' as const, required: true, label: 'URL' },
]

export const Navigation: GlobalConfig = {
  slug: 'navigation',
  label: 'Navigacija',
  access: {
    read: publicRead,
    update: isAdmin,
  },
  fields: [
    {
      name: 'mainNav',
      type: 'array',
      label: 'Glavna navigacija',
      fields: [
        ...navItemFields,
        {
          name: 'children',
          type: 'array',
          label: 'Podizbornik',
          fields: navItemFields,
        },
      ],
    },
    {
      name: 'footerNav',
      type: 'array',
      label: 'Footer navigacija',
      fields: navItemFields,
    },
  ],
}
