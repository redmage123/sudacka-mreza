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
    group: { hr: 'Stečaj', en: 'Bankruptcy' },
    description: {
      hr: 'Stečajni podnesci urednika koji čekaju pregled administratora.',
      en: 'Editor-submitted bankruptcy filings pending admin review.',
    },
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
      label: { hr: 'Vrsta podneska', en: 'Filing type' },
      options: [
        { label: { hr: 'Prijedlog za pokretanje', en: 'Motion to open' }, value: 'motion-to-open' },
        { label: { hr: 'Prijava tražbine', en: 'Creditor claim' }, value: 'prijava-trazbine' },
        { label: { hr: 'Popis imovine', en: 'Asset inventory' }, value: 'asset-inventory' },
        { label: { hr: 'Prodaja imovine', en: 'Asset sale' }, value: 'asset-sale' },
        { label: { hr: 'Izvještaj stečajnog upravitelja', en: 'Trustee report' }, value: 'trustee-report' },
        { label: { hr: 'Prijedlog raspodjele', en: 'Distribution proposal' }, value: 'distribution-proposal' },
        { label: { hr: 'Završni račun', en: 'Final accounting' }, value: 'final-accounting' },
        { label: { hr: 'Plan restrukturiranja', en: 'Restructuring plan' }, value: 'restructuring-plan' },
        { label: { hr: 'Predstečajna nagodba', en: 'Pre-bankruptcy settlement' }, value: 'pre-bankruptcy-settlement' },
      ],
    },
    {
      name: 'caseNumber',
      type: 'text',
      label: { hr: 'Broj predmeta', en: 'Case number' },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending_review',
      label: { hr: 'Status', en: 'Status' },
      options: [
        { label: { hr: 'Čeka pregled', en: 'Pending review' }, value: 'pending_review' },
        { label: { hr: 'Odobreno', en: 'Approved' }, value: 'approved' },
        { label: { hr: 'Odbijeno', en: 'Rejected' }, value: 'rejected' },
      ],
    },
    {
      name: 'submittedBy',
      type: 'text',
      label: { hr: 'Podnositelj', en: 'Submitted by' },
      admin: {
        description: {
          hr: 'Email adresa urednika koji je podnio podnesak (postavlja poslužitelj).',
          en: 'Email of the submitting editor (server-set).',
        },
        readOnly: true,
      },
    },
    {
      name: 'data',
      type: 'json',
      label: { hr: 'Podaci obrasca', en: 'Form data' },
    },
    {
      name: 'attachmentBase64',
      type: 'textarea',
      label: { hr: 'Izvorni dokument (base64 PDF)', en: 'Original document (base64 PDF)' },
      admin: {
        description: {
          hr: 'Izvorno učitana datoteka, base64-kodirana.',
          en: 'Original uploaded source, base64-encoded.',
        },
        hidden: true,
      },
    },
    {
      name: 'attachmentFilename',
      type: 'text',
      label: { hr: 'Naziv priložene datoteke', en: 'Attachment filename' },
    },
    {
      name: 'reviewNotes',
      type: 'textarea',
      label: { hr: 'Bilješke pregleda', en: 'Review notes' },
      admin: {
        description: {
          hr: 'Administratorske bilješke pri odobravanju ili odbijanju podneska.',
          en: 'Admin notes when approving or rejecting this filing.',
        },
      },
    },
    {
      name: 'publishedAt',
      type: 'date',
      label: { hr: 'Vrijeme podnošenja', en: 'Submitted at' },
      admin: {
        description: {
          hr: 'Izvorno vrijeme podnošenja od strane urednika.',
          en: 'Original submission timestamp from the editor.',
        },
        date: { pickerAppearance: 'dayAndTime' },
        readOnly: true,
      },
    },
  ],
}
