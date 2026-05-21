import type { CollectionConfig } from 'payload'
import { generateSlug } from '../hooks/generateSlug.js'
import { isAdmin, isAdminOrEditor, publicRead } from '../access.js'

/**
 * Phase 1 judge-dashboard fields — photo, name split, department enum,
 * yearsOfExperience. The legacy `name` field stays as the canonical
 * "Ime i prezime" display string so existing slugs/links don't churn;
 * firstName/lastName are added for the mockup header which renders Ime
 * and Prezime on separate lines.
 */
export const Judges: CollectionConfig = {
  slug: 'judges',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'court', 'department', 'status', 'lang'],
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
      admin: {
        description: 'Puno ime (Ime + Prezime) — koristi se za prikaz i slug.',
      },
    },
    {
      name: 'firstName',
      type: 'text',
      label: 'Ime',
      admin: {
        description: 'Samo ime. Auto-popunjeno iz `name` u migraciji.',
      },
    },
    {
      name: 'lastName',
      type: 'text',
      label: 'Prezime',
      admin: {
        description: 'Samo prezime. Auto-popunjeno iz `name` u migraciji.',
      },
    },
    {
      name: 'photo',
      type: 'upload',
      relationTo: 'media',
      label: 'Fotografija',
      admin: {
        description: 'Profilna fotografija prikazana u zaglavlju profila.',
      },
    },
    {
      name: 'court',
      type: 'relationship',
      relationTo: 'courts',
      label: 'Sud',
      admin: {
        description: 'Primarni sud kojemu je sudac dodijeljen',
      },
    },
    {
      name: 'appointmentDate',
      type: 'date',
      label: 'Datum imenovanja',
      admin: {
        description: 'Datum od kada je sudac raspoređen na ovaj sud (datum_od iz sudac_suda)',
        position: 'sidebar',
      },
    },
    {
      name: 'yearsOfExperience',
      type: 'number',
      label: 'Godine iskustva',
      admin: {
        description: 'Ručno postavljeno ili izračunato iz appointmentDate. Nullable.',
        position: 'sidebar',
      },
    },
    {
      name: 'department',
      type: 'select',
      label: 'Odjel',
      admin: {
        description: 'Predmetni odjel suda — usklađeno s court_decisions.decision_type.',
      },
      options: [
        { label: 'Građanski', value: 'civil' },
        { label: 'Kazneni', value: 'criminal' },
        { label: 'Trgovački', value: 'commercial' },
        { label: 'Upravni', value: 'administrative' },
        { label: 'Ustavni', value: 'constitutional' },
        { label: 'Prekršajni', value: 'misdemeanor' },
        { label: 'Obiteljski', value: 'family' },
        { label: 'Radni', value: 'labour' },
        { label: 'Ostalo', value: 'other' },
      ],
    },
    {
      name: 'specialization',
      type: 'text',
      label: 'Specijalizacija (legacy)',
      admin: {
        description: 'Slobodni tekst iz legacy sudac_suda.odjel1 — nove zapise koristite `department`.',
      },
    },
    {
      name: 'status',
      type: 'select',
      label: 'Status',
      defaultValue: 'active',
      options: [
        { label: 'Aktivan', value: 'active' },
        { label: 'Neaktivan', value: 'inactive' },
      ],
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'email',
      type: 'email',
      label: 'Email',
    },
    {
      name: 'lang',
      type: 'select',
      required: true,
      defaultValue: 'hr',
      label: 'Jezik',
      options: [
        { label: 'Hrvatski', value: 'hr' },
        { label: 'English', value: 'en' },
        { label: 'Srpski', value: 'sr' },
        { label: 'Makedonski', value: 'mk' },
      ],
      admin: {
        position: 'sidebar',
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
