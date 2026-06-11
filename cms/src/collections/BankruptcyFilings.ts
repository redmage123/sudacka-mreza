import type { Access, CollectionConfig, FieldAccess } from 'payload'
import { isAdmin, isLegalEntityOrAbove } from '../access.js'

// Public reads see only approved filings; editors and legal entities also see
// their own (regardless of status). Admins see everything.
const readPublicApprovedOrOwn: Access = ({ req }) => {
  if (req.user?.role === 'admin') return true
  const email = req.user?.email ?? ''
  if (req.user?.role === 'editor' || req.user?.role === 'legal_entity') {
    return {
      or: [
        { status: { equals: 'approved' } },
        { submittedBy: { equals: email } },
      ],
    }
  }
  return { status: { equals: 'approved' } }
}

// attachmentBase64 stays admin/owner-only — public listings never expose the
// raw PDF, only metadata. FieldAccess returns boolean only.
const readAttachmentOwnerOrAdmin: FieldAccess = ({ req, doc }) => {
  if (!req.user) return false
  if (req.user.role === 'admin') return true
  if (
    (req.user.role === 'editor' || req.user.role === 'legal_entity') &&
    (doc as { submittedBy?: string } | undefined)?.submittedBy === req.user.email
  ) {
    return true
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
    read: readPublicApprovedOrOwn,
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
      access: {
        read: readAttachmentOwnerOrAdmin,
      },
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
