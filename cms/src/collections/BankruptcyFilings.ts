import type { Access, CollectionConfig } from 'payload'
import { isAdmin, isLegalEntityOrAbove } from '../access.js'

// Non-admins (editors + legal entities) read only their own submissions;
// admins read everything.
const readOwnOrAdmin: Access = ({ req }) => {
  if (!req.user) return false
  if (req.user.role === 'admin') return true
  if (req.user.role === 'editor' || req.user.role === 'legal_entity') {
    return { submittedBy: { equals: req.user.email } }
  }
  return false
}

export const BankruptcyFilings: CollectionConfig = {
  slug: 'bankruptcy-filings',
  admin: {
    group: 'Stečaj',
    description: 'Editor-submitted bankruptcy filings pending admin review.',
    useAsTitle: 'caseNumber',
    defaultColumns: ['filingType', 'caseNumber', 'submittedBy', 'status', 'createdAt'],
  },
  access: {
    read: readOwnOrAdmin,
    create: isLegalEntityOrAbove,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    {
      name: 'filingType',
      type: 'select',
      required: true,
      label: 'Vrsta podneska / Filing type',
      options: [
        { label: 'Motion to open / Prijedlog za pokretanje', value: 'motion-to-open' },
        { label: 'Prijava tražbine / Creditor claim', value: 'prijava-trazbine' },
        { label: 'Asset inventory / Popis imovine', value: 'asset-inventory' },
        { label: 'Asset sale / Prodaja imovine', value: 'asset-sale' },
        { label: 'Trustee report / Izvještaj stečajnog upravitelja', value: 'trustee-report' },
        { label: 'Distribution proposal / Prijedlog raspodjele', value: 'distribution-proposal' },
        { label: 'Final accounting / Završni račun', value: 'final-accounting' },
        { label: 'Restructuring plan / Plan restrukturiranja', value: 'restructuring-plan' },
        { label: 'Pre-bankruptcy settlement / Predstečajna nagodba', value: 'pre-bankruptcy-settlement' },
      ],
    },
    {
      name: 'caseNumber',
      type: 'text',
      label: 'Broj predmeta / Case number',
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending_review',
      label: 'Status',
      options: [
        { label: 'Pending review', value: 'pending_review' },
        { label: 'Approved', value: 'approved' },
        { label: 'Rejected', value: 'rejected' },
      ],
    },
    {
      name: 'submittedBy',
      type: 'text',
      label: 'Submitted by',
      admin: {
        description: 'Email of the submitting editor (server-set).',
        readOnly: true,
      },
    },
    {
      name: 'data',
      type: 'json',
      label: 'Form data',
    },
    {
      name: 'attachmentBase64',
      type: 'textarea',
      label: 'Original document (base64 PDF)',
      admin: {
        description: 'Original uploaded source, base64-encoded.',
        hidden: true,
      },
    },
    {
      name: 'attachmentFilename',
      type: 'text',
      label: 'Attachment filename',
    },
    {
      name: 'reviewNotes',
      type: 'textarea',
      label: 'Review notes',
      admin: {
        description: 'Admin notes when approving or rejecting this filing.',
      },
    },
    {
      name: 'publishedAt',
      type: 'date',
      label: 'Submitted at',
      admin: {
        description: 'Original submission timestamp from the editor.',
        date: { pickerAppearance: 'dayAndTime' },
        readOnly: true,
      },
    },
  ],
}
