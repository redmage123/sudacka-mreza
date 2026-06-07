import type { GlobalConfig } from 'payload'
import { isAdmin, publicRead } from '../access.js'

export const Settings: GlobalConfig = {
  slug: 'settings',
  label: 'Postavke stranice',
  admin: { group: 'Postavke' },
  access: {
    read: publicRead,
    update: isAdmin,
  },
  fields: [
    {
      name: 'siteName',
      type: 'text',
      defaultValue: 'Sudačka Mreža',
      label: 'Naziv stranice',
    },
    {
      name: 'siteTaglineHr',
      type: 'text',
      label: 'Sažetak (HR)',
    },
    {
      name: 'siteTaglineEn',
      type: 'text',
      label: 'Tagline (EN)',
    },
    {
      name: 'contactEmail',
      type: 'email',
      label: 'Kontakt email',
    },
    {
      name: 'donateUrl',
      type: 'text',
      label: 'URL za donacije',
    },
    {
      name: 'socialLinks',
      type: 'array',
      label: 'Društvene mreže',
      fields: [
        {
          name: 'platform',
          type: 'text',
          required: true,
          label: 'Platforma',
          admin: {
            description: 'npr. Twitter, LinkedIn, Facebook',
          },
        },
        {
          name: 'url',
          type: 'text',
          required: true,
          label: 'URL',
        },
      ],
    },
  ],
}
