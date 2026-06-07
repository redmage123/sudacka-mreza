import type { CollectionConfig } from 'payload'

// Stores RLHF-style human feedback on chat assistant answers. Public POST
// (anonymous), admin-only read so privacy isn't accidentally exposed.
export const ChatFeedback: CollectionConfig = {
  slug: 'chat-feedback',
  admin: {
    group: 'Korisničke akcije',
    useAsTitle: 'question',
    defaultColumns: ['question', 'lang', 'verdict', 'status', 'createdAt'],
    description: 'Povratne informacije korisnika na chatbot odgovore (RLHF signal).',
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
    { name: 'conversationId', type: 'text', required: true, index: true },
    { name: 'question', type: 'textarea', required: true },
    { name: 'lang', type: 'text', required: true, maxLength: 5, index: true },
    { name: 'modelAnswer', type: 'textarea', required: true },
    { name: 'modelVersion', type: 'text' },
    {
      name: 'verdict',
      type: 'select',
      required: true,
      options: [
        { label: 'Helpful', value: 'good' },
        { label: 'Not helpful', value: 'bad' },
      ],
      index: true,
    },
    { name: 'correction', type: 'textarea' },
    { name: 'reason', type: 'textarea' },
    {
      name: 'citations',
      type: 'json',
      admin: { description: 'Citations array snapshot from the chat response.' },
    },
    { name: 'user', type: 'relationship', relationTo: 'users' },
    { name: 'ip', type: 'text', admin: { readOnly: true } },
    { name: 'userAgent', type: 'text', admin: { readOnly: true } },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: [
        { label: 'Pending review', value: 'pending' },
        { label: 'Approved (use for fine-tune)', value: 'approved' },
        { label: 'Rejected', value: 'rejected' },
      ],
      index: true,
    },
    { name: 'reviewer', type: 'relationship', relationTo: 'users' },
    { name: 'reviewedAt', type: 'date' },
  ],
  timestamps: true,
}
