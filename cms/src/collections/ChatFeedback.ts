import type { CollectionConfig } from 'payload'

// Stores RLHF-style human feedback on chat assistant answers. Public POST
// (anonymous), admin-only read so privacy isn't accidentally exposed.
export const ChatFeedback: CollectionConfig = {
  slug: 'chat-feedback',
  admin: {
    useAsTitle: 'question',
    defaultColumns: ['question', 'lang', 'verdict', 'status', 'createdAt'],
    description: {
      hr: 'Povratne informacije korisnika na odgovore chatbota — ulaz za buduće fine-tune cikluse.',
      en: 'Human feedback on chatbot answers — input for fine-tuning runs.',
    },
  },
  access: {
    // Created by the public /api/chat-feedback router (server-side). No
    // direct create through Payload REST.
    create: () => false,
    read: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    {
      name: 'conversationId',
      type: 'text',
      required: true,
      index: true,
      label: { hr: 'ID razgovora', en: 'Conversation ID' },
    },
    {
      name: 'question',
      type: 'textarea',
      required: true,
      label: { hr: 'Pitanje', en: 'Question' },
    },
    {
      name: 'lang',
      type: 'text',
      required: true,
      maxLength: 5,
      index: true,
      label: { hr: 'Jezik', en: 'Language' },
    },
    {
      name: 'modelAnswer',
      type: 'textarea',
      required: true,
      label: { hr: 'Odgovor modela', en: 'Model answer' },
    },
    {
      name: 'modelVersion',
      type: 'text',
      label: { hr: 'Verzija modela', en: 'Model version' },
    },
    {
      name: 'verdict',
      type: 'select',
      required: true,
      label: { hr: 'Ocjena', en: 'Verdict' },
      options: [
        { label: { hr: 'Korisno', en: 'Helpful' }, value: 'good' },
        { label: { hr: 'Nije korisno', en: 'Not helpful' }, value: 'bad' },
      ],
      index: true,
    },
    {
      name: 'correction',
      type: 'textarea',
      label: { hr: 'Ispravak', en: 'Correction' },
    },
    {
      name: 'reason',
      type: 'textarea',
      label: { hr: 'Obrazloženje', en: 'Reason' },
    },
    {
      name: 'citations',
      type: 'json',
      label: { hr: 'Citati', en: 'Citations' },
      admin: {
        description: {
          hr: 'Snimka liste citata iz odgovora chatbota.',
          en: 'Citations array snapshot from the chat response.',
        },
      },
    },
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      label: { hr: 'Korisnik', en: 'User' },
    },
    {
      name: 'ip',
      type: 'text',
      label: { hr: 'IP adresa', en: 'IP address' },
      admin: { readOnly: true },
    },
    {
      name: 'userAgent',
      type: 'text',
      label: { hr: 'User Agent', en: 'User agent' },
      admin: { readOnly: true },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      label: { hr: 'Status', en: 'Status' },
      options: [
        { label: { hr: 'Čeka pregled', en: 'Pending review' }, value: 'pending' },
        { label: { hr: 'Odobreno (koristiti za fine-tune)', en: 'Approved (use for fine-tune)' }, value: 'approved' },
        { label: { hr: 'Odbijeno', en: 'Rejected' }, value: 'rejected' },
      ],
      index: true,
    },
    {
      name: 'reviewer',
      type: 'relationship',
      relationTo: 'users',
      label: { hr: 'Pregledao', en: 'Reviewer' },
    },
    {
      name: 'reviewedAt',
      type: 'date',
      label: { hr: 'Vrijeme pregleda', en: 'Reviewed at' },
    },
  ],
  timestamps: true,
}
