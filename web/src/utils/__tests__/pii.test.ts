import { describe, it, expect } from 'vitest'
import { initialsOf, redactText, judgePanelLabel } from '../pii'

describe('initialsOf', () => {
  it('collapses two-part Croatian name to "M.M."', () => {
    expect(initialsOf('Marko Marković')).toBe('M.M.')
  })

  it('handles three-part name', () => {
    expect(initialsOf('Marija Ana Horvat-Kovač')).toBe('M.A.H.')
  })

  it('strips academic titles', () => {
    expect(initialsOf('mr.sc. Branislav Dimitrijević')).toBe('B.D.')
    expect(initialsOf('dr.sc. Ana Horvat')).toBe('A.H.')
    expect(initialsOf('doc.dr. Marko Marić')).toBe('M.M.')
  })

  it('handles diacritics in initials', () => {
    expect(initialsOf('Čedomir Šimić')).toBe('Č.Š.')
  })

  it('returns empty for null / undefined / empty', () => {
    expect(initialsOf(null)).toBe('')
    expect(initialsOf(undefined)).toBe('')
    expect(initialsOf('')).toBe('')
    expect(initialsOf('   ')).toBe('')
  })

  it('handles single-name (no surname)', () => {
    expect(initialsOf('Aristotel')).toBe('A.')
  })

  it('judgePanelLabel joins multiple judges', () => {
    expect(judgePanelLabel(['Marko Marković', 'Ana Horvat'])).toBe('M.M. / A.H.')
  })
})

describe('redactText — OIBs and contacts', () => {
  it('redacts 11-digit OIBs', () => {
    expect(redactText('OIB: 12345678901, adresa…')).toContain('[OIB]')
    expect(redactText('OIB: 12345678901')).not.toMatch(/\d{11}/)
  })

  it('does not redact shorter numbers', () => {
    expect(redactText('predmet broj 12345/2024')).toContain('12345/2024')
  })

  it('redacts e-mails', () => {
    expect(redactText('javiti se na ivan@example.com radi…')).toContain('[email]')
  })

  it('redacts phone numbers (HR format)', () => {
    expect(redactText('telefon +385 1 234 5678')).toContain('[telefon]')
    expect(redactText('telefon 01 234 56 78')).toContain('[telefon]')
  })

  it('redacts IBANs', () => {
    expect(redactText('IBAN: HR1234567890123456789')).toContain('[IBAN]')
  })

  it('is idempotent (running twice yields same result)', () => {
    const once = redactText('OIB: 12345678901 ivan@example.com')
    expect(redactText(once)).toBe(once)
  })
})

describe('redactText — citizen names', () => {
  it('redacts "tužitelj <Name>" to initials', () => {
    const result = redactText('protiv tužitelja Ivana Novaka iz Zagreba')
    expect(result).not.toContain('Ivana Novaka')
    expect(result).toContain('tužitelja I.N.')
  })

  it('redacts "tuženika <Name Name Name>"', () => {
    expect(redactText('odbija se zahtjev tuženika Marka Antonijevog Markovića'))
      .toContain('tuženika M.A.M.')
  })

  it('keeps institution names unchanged after "tužitelja"', () => {
    expect(redactText('tužitelja Zavoda za zdravstveno osiguranje'))
      .toContain('Zavoda')
    expect(redactText('tužitelja HEP-a'))
      .toContain('HEP-a')
  })

  it('does NOT redact names after judge / professional markers', () => {
    expect(redactText('po sutkinji Marijani Jurenec')).toContain('Marijani Jurenec')
    expect(redactText('vještak Dražen Horvat')).toContain('Dražen Horvat')
    expect(redactText('javni bilježnik Renata Kutija')).toContain('Renata Kutija')
  })
})

describe('redactText — addresses', () => {
  it('redacts "ulica X Y 25"', () => {
    expect(redactText('boravi u ulici Ilica 25 u Zagrebu')).toContain('[adresa]')
  })

  it('redacts "Trg X 5"', () => {
    expect(redactText('Trg kralja Tomislava 36, Velika Gorica')).toContain('[adresa]')
  })

  it('leaves case-number-like patterns alone', () => {
    expect(redactText('Poslovni broj: P-246/2024-3'))
      .toContain('P-246/2024-3')
  })
})

describe('redactText — null / empty', () => {
  it('returns empty for null', () => {
    expect(redactText(null)).toBe('')
    expect(redactText(undefined)).toBe('')
    expect(redactText('')).toBe('')
  })
})
