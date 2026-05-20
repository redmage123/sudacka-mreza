import type { CollectionConfig } from 'payload'
import { generateSlug } from '../hooks/generateSlug.js'
import { isAdmin, isAdminOrEditor, publicRead } from '../access.js'

export const Courts: CollectionConfig = {
  slug: 'courts',
  admin: {
    group: 'Sudovi',
    description: 'Hrvatski sudovi: županijski, općinski, trgovački, prekršajni, Vrhovni i Ustavni.',
    useAsTitle: 'name',
    defaultColumns: ['name', 'type', 'city', 'county'],
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
      label: 'Naziv suda',
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      label: 'Vrsta suda',
      options: [
        { label: 'Općinski sud', value: 'municipal' },
        { label: 'Županijski sud', value: 'county' },
        { label: 'Trgovački sud', value: 'commercial' },
        { label: 'Prekršajni sud', value: 'misdemeanour' },
        { label: 'Visoki trgovački sud', value: 'high_commercial' },
        { label: 'Vrhovni sud', value: 'supreme' },
        { label: 'Upravni sud', value: 'administrative' },
        { label: 'Ustavni sud', value: 'constitutional' },
      ],
    },
    {
      name: 'address',
      type: 'text',
      label: 'Adresa',
    },
    {
      name: 'city',
      type: 'text',
      required: true,
      label: 'Grad',
    },
    {
      name: 'county',
      type: 'text',
      label: 'Županija',
    },
    {
      name: 'phone',
      type: 'text',
      label: 'Telefon',
    },
    {
      name: 'fax',
      type: 'text',
      label: 'Fax',
    },
    {
      name: 'email',
      type: 'email',
      label: 'Email',
    },
    {
      name: 'website',
      type: 'text',
      label: 'Web stranica',
    },
    {
      name: 'president',
      type: 'text',
      label: 'Predsjednik suda',
    },
    {
      name: 'departments',
      type: 'array',
      label: 'Odjeli suda',
      admin: {
        description: 'Pisarnica, ured predsjednika, tajnik, glasnogovornik i drugi unutarnji odjeli',
      },
      fields: [
        {
          name: 'name',
          type: 'text',
          required: true,
          label: 'Naziv odjela',
        },
        {
          name: 'type',
          type: 'select',
          label: 'Vrsta odjela',
          options: [
            { label: 'Pisarnica / Registry', value: 'registry' },
            { label: 'Ured predsjednika / President’s office', value: 'president' },
            { label: 'Tajnik / Secretary', value: 'secretary' },
            { label: 'Glasnogovornik / Spokesperson', value: 'spokesperson' },
            { label: 'Ostalo / Other', value: 'other' },
          ],
        },
        {
          name: 'head',
          type: 'text',
          label: 'Voditelj / Odgovorna osoba',
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
          name: 'notes',
          type: 'textarea',
          label: 'Napomene',
        },
      ],
    },
    {
      name: 'lat',
      type: 'number',
      label: 'Geografska širina',
    },
    {
      name: 'lng',
      type: 'number',
      label: 'Geografska dužina',
    },
    {
      name: 'jurisdictionArea',
      type: 'json',
      label: 'Područje nadležnosti (GeoJSON)',
      admin: {
        description: 'GeoJSON Polygon koji se prikazuje na Leaflet karti nadležnosti',
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
