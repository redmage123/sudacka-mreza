import type { CollectionConfig } from 'payload'
import { generateSlug } from '../hooks/generateSlug.js'
import { isAdmin, isAdminOrEditor, publicRead } from '../access.js'

export const BankruptcyAdministrators: CollectionConfig = {
  slug: 'bankruptcy-administrators',
  admin: {
    group: 'Stečaj',
    description: 'Stečajni upravitelji.',
    useAsTitle: 'name',
    defaultColumns: ['name', 'licenceNumber', 'city', 'county'],
  },
  access: {
    read: publicRead,
    create: isAdminOrEditor,
    update: isAdminOrEditor,
    delete: isAdmin,
  },
  hooks: {
    beforeChange: [generateSlug('name')],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      label: 'Ime i prezime',
    },
    {
      name: 'licenceNumber',
      type: 'text',
      label: 'Broj licence',
      admin: {
        description: 'Broj licence stečajnog upravitelja',
      },
    },
    {
      name: 'phone',
      type: 'text',
      label: 'Telefon',
    },
    {
      name: 'email',
      type: 'email',
      label: 'Email',
    },
    {
      name: 'address',
      type: 'text',
      label: 'Adresa',
    },
    {
      name: 'city',
      type: 'text',
      label: 'Grad',
    },
    {
      name: 'county',
      type: 'text',
      label: 'Županija',
    },
    {
      name: 'courts',
      type: 'relationship',
      relationTo: 'courts',
      hasMany: true,
      label: 'Pripadnost sudu',
      admin: {
        description: 'Sudovi kojima stečajni upravitelj pripada / na kojima je imenovan',
      },
    },
    {
      name: 'assignedCases',
      type: 'relationship',
      relationTo: 'bankruptcy-listings',
      hasMany: true,
      label: 'Dodijeljeni stečajni postupci',
      admin: {
        description: 'Stečajni postupci u kojima je ovaj upravitelj imenovan',
      },
    },
    {
      name: 'slug',
      type: 'text',
      unique: true,
      index: true,
      admin: {
        readOnly: true,
      },
    },
  ],
}
