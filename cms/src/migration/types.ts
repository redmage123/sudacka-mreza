/**
 * Shared types for the Sudačka Mreža data-migration scripts.
 *
 * "Scraped*" types represent raw rows extracted from the old ASP.NET site.
 * They are serialised to JSON in the data/ directory, then read by importer.ts
 * which maps them to Payload Local API payloads.
 */

export interface ScrapedCourt {
  name: string
  /** Raw Croatian text — mapped to a Payload enum value on import */
  type: string
  address?: string
  city: string
  county?: string
  phone?: string
  fax?: string
  email?: string
  website?: string
  president?: string
}

export interface ScrapedExpert {
  name: string
  specialityAreas: string[]
  /** BCP-47 codes derived from the site text, e.g. ["hr", "en"] */
  languages: string[]
  county?: string
  city?: string
  phone?: string
  email?: string
  /** Resolved to Payload court IDs during import */
  courtNames: string[]
}

export interface ScrapedInterpreter {
  name: string
  /** Raw language-pair strings — normalised to "xx-yy" format on import */
  languagePairs: string[]
  county?: string
  city?: string
  phone?: string
  email?: string
  /** Resolved to Payload court IDs during import */
  courtNames: string[]
}

export interface ScrapedStateAttorney {
  name: string
  address?: string
  city: string
  county?: string
  phone?: string
  fax?: string
  email?: string
}

export interface ScrapedDecision {
  title: string
  /** Resolved to a Payload court ID during import */
  courtName: string
  /** Raw text — mapped to Payload enum value on import */
  decisionType: string
  /** ISO-8601 date string */
  date: string
  caseNumber: string
  summary?: string
  category?: string
  fullText?: string
}

export interface ScrapedBankruptcyAdmin {
  name: string
  licenceNumber?: string
  phone?: string
  email?: string
  address?: string
  city?: string
  county?: string
}

export interface ScrapedBankruptcyListing {
  caseNumber: string
  debtorName: string
  /** Resolved to a Payload court ID during import */
  courtName: string
  /** Resolved to a Payload bankruptcy-administrator ID during import */
  administratorName?: string
  deadline?: string
  status: string
  publishedAt?: string
  contactEmail?: string
  contactPhone?: string
  description?: string
}

/**
 * A single asset sale offer from a bankruptcy proceeding.
 * Scraped from /stecaj-ponude.aspx.
 */
export interface ScrapedBankruptcySale {
  title: string
  description: string
  price: string
  deadline: string
  contact?: string
}
