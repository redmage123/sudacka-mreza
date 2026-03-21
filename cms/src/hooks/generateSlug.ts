import type { CollectionBeforeChangeHook } from 'payload'

const croatianMap: Record<string, string> = {
  'đ': 'd',
  'Đ': 'd',
  'č': 'c',
  'Č': 'c',
  'ć': 'c',
  'Ć': 'c',
  'š': 's',
  'Š': 's',
  'ž': 'z',
  'Ž': 'z',
}

function transliterate(str: string): string {
  return str.replace(/[đĐčČćĆšŠžŽ]/g, (match) => croatianMap[match] || match)
}

function toSlug(value: string): string {
  const transliterated = transliterate(value)
  return transliterated
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function generateSlug(fieldName: string): CollectionBeforeChangeHook {
  return ({ data, operation }) => {
    if (operation === 'create' || (operation === 'update' && data?.[fieldName])) {
      const sourceValue = data?.[fieldName]
      if (sourceValue && typeof sourceValue === 'string') {
        data!.slug = toSlug(sourceValue)
      }
    }
    return data
  }
}
