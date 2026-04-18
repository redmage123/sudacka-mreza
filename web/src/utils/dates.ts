export function formatDate(isoDate: string, lang: string | undefined): string {
  const locale = lang === 'en' ? 'en-GB' : 'hr-HR'
  try {
    return new Date(isoDate).toLocaleDateString(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  } catch {
    return isoDate
  }
}
