import type { Field } from 'payload'
import { WEEKDAYS } from './croatia-taxonomy.js'

// Structured per-weekday working hours.
// Each row: weekday + optional open/close (HH:MM) + optional second window
// (e.g. registry open Mon-Fri 7:30-15:30, public service 9:00-13:00).
export function workingHoursField(name: string, label: string, description?: string): Field {
  return {
    name,
    type: 'array',
    label,
    admin: { description },
    fields: [
      {
        name: 'weekday',
        type: 'select',
        required: true,
        label: 'Dan u tjednu',
        options: WEEKDAYS.map((d) => ({ label: d.label, value: d.value })),
      },
      { name: 'closed', type: 'checkbox', label: 'Zatvoreno', defaultValue: false },
      { name: 'openTime', type: 'text', label: 'Otvaranje (HH:MM)', admin: { placeholder: '08:00' } },
      { name: 'closeTime', type: 'text', label: 'Zatvaranje (HH:MM)', admin: { placeholder: '16:00' } },
      { name: 'secondOpenTime', type: 'text', label: 'Drugi termin — otvaranje (HH:MM)', admin: { placeholder: '17:00' } },
      { name: 'secondCloseTime', type: 'text', label: 'Drugi termin — zatvaranje (HH:MM)', admin: { placeholder: '19:00' } },
      { name: 'note', type: 'text', label: 'Napomena' },
    ],
  }
}
