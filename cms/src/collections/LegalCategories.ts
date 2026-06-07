import type { CollectionConfig } from 'payload'
import { generateSlug } from '../hooks/generateSlug.js'
import { isAdmin, isAdminOrEditor, publicRead } from '../access.js'

export const LegalCategories: CollectionConfig = {
  slug: 'legal-categories',
  admin: {
    useAsTitle: 'name_hr',
    defaultColumns: ['name_hr', 'name_en', 'parent', 'slug'],
    group: 'Sudovi',
    description: 'Taksonomija pravnih područja (radno pravo, kazneno, građansko itd.).',
  },
  access: {
    read: publicRead,
    create: isAdminOrEditor,
    update: isAdminOrEditor,
    delete: isAdmin,
  },
  hooks: {
    beforeChange: [generateSlug('name_hr')],
  },
  fields: [
    {
      name: 'name_hr',
      type: 'text',
      required: true,
      label: 'Naziv (HR)',
      admin: {
        description: 'Naziv pravnog područja na hrvatskom',
      },
    },
    {
      name: 'name_en',
      type: 'text',
      label: 'Name (EN)',
      admin: {
        description: 'Legal area name in English',
      },
    },
    {
      name: 'slug',
      type: 'text',
      unique: true,
      index: true,
      admin: {
        readOnly: true,
        description: 'Auto-generirano iz naziva (HR)',
      },
    },
    {
      // Self-referencing for hierarchical sub-categories (e.g. Kazneno → Maloljetničko kazneno)
      name: 'parent',
      type: 'relationship',
      relationTo: 'legal-categories',
      label: 'Nadređena kategorija',
      admin: {
        description: 'Ostavite prazno za kategorije na vrhu hijerarhije',
      },
    },
    {
      name: 'icon',
      type: 'text',
      label: 'Ikona',
      admin: {
        description: 'Lucide ikona ili emoji (npr. "scale", "gavel", "⚖️")',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      label: 'Opis',
      admin: {
        description: 'Kratki opis pravnog područja',
      },
    },
  ],
}
