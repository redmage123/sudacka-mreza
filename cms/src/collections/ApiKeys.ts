import { randomBytes } from 'crypto'
import type { CollectionConfig } from 'payload'
import { isAdmin } from '../access.js'

/**
 * ApiKeys collection
 *
 * Stores API keys for third-party consumers of the public REST API (/api/v1/*).
 * Keys are auto-generated on creation (sm_ prefix + 48 random hex chars).
 * Only admins can manage keys; the key value is read-only after creation.
 */
export const ApiKeys: CollectionConfig = {
  slug: 'api-keys',
  labels: {
    singular: 'API Ključ',
    plural: 'API Ključevi',
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'organization', 'email', 'rateLimit', 'active', 'createdAt'],
    description: 'API ključevi za pristup javnom REST API-ju (/api/v1/*)',
  },
  access: {
    read: isAdmin,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  hooks: {
    beforeChange: [
      ({ data, operation }) => {
        if (operation === 'create') {
          // Generate once on creation — never regenerated on update
          data.key = `sm_${randomBytes(24).toString('hex')}`
        }
        return data
      },
    ],
  },
  fields: [
    {
      name: 'key',
      type: 'text',
      unique: true,
      index: true,
      label: 'API Ključ',
      admin: {
        readOnly: true,
        description: 'Automatski generiran pri stvaranju — ne mijenjati ručno.',
      },
    },
    {
      name: 'name',
      type: 'text',
      required: true,
      label: 'Naziv',
      admin: {
        description: 'Prijateljski naziv za ovaj ključ (npr. "Vrhovni sud Srbije")',
      },
    },
    {
      name: 'organization',
      type: 'text',
      label: 'Organizacija',
      admin: {
        description: 'Institucija ili tvrtka kojoj ključ pripada',
      },
    },
    {
      name: 'email',
      type: 'email',
      label: 'Email kontakt',
      admin: {
        description: 'Tehnički kontakt odgovoran za integraciju',
      },
    },
    {
      name: 'rateLimit',
      type: 'number',
      label: 'Ograničenje zahtjeva po minuti',
      defaultValue: 1000,
      min: 1,
      max: 10_000,
      admin: {
        description: 'Maksimalni broj API poziva po minuti za ovaj ključ (zadano: 1 000)',
      },
    },
    {
      name: 'active',
      type: 'checkbox',
      label: 'Aktivan',
      defaultValue: true,
      admin: {
        description: 'Deaktiviraj kako bi blokirao pristup bez brisanja ključa',
      },
    },
  ],
}
