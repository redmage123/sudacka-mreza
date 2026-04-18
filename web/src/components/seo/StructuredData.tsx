/**
 * StructuredData — renders JSON-LD <script> tags via react-helmet-async.
 *
 * Usage:
 *   <StructuredData schema={organizationSchema()} />
 *   <StructuredData schema={legalServiceSchema({ name, address, url })} />
 *   <StructuredData schema={articleSchema({ headline, datePublished, ... })} />
 *   <StructuredData schema={personSchema({ name, jobTitle, ... })} />
 */

import { Helmet } from 'react-helmet-async'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OrganizationSchemaProps {
  url?: string
  logoUrl?: string
}

export interface LegalServiceSchemaProps {
  name: string
  url: string
  description?: string
  addressLocality?: string
  addressRegion?: string
  postalCode?: string
  streetAddress?: string
  telephone?: string
  courtType?: string
}

export interface ArticleSchemaProps {
  headline: string
  url: string
  datePublished: string
  dateModified?: string
  description?: string
  imageUrl?: string
  authorName?: string
}

export interface PersonSchemaProps {
  name: string
  url: string
  jobTitle?: string
  description?: string
  specialty?: string
  telephone?: string
  email?: string
  addressLocality?: string
}

// ─── Schema builders ──────────────────────────────────────────────────────────

export function organizationSchema({
  url = 'https://sudacka-mreza.hr',
  logoUrl = 'https://sudacka-mreza.hr/assets/sudacka-mreza-logo.gif',
}: OrganizationSchemaProps = {}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Sudačka Mreža',
    alternateName: 'Sudacka Mreza',
    url,
    logo: {
      '@type': 'ImageObject',
      url: logoUrl,
    },
    description:
      'Portal za sudsku praksu, pravne informacije, sudske vještake i tumače u Republici Hrvatskoj.',
    inLanguage: ['hr', 'en'],
    areaServed: {
      '@type': 'Country',
      name: 'Croatia',
    },
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      availableLanguage: ['Croatian', 'English'],
    },
    sameAs: ['https://sudacka-mreza.hr'],
  }
}

export function legalServiceSchema({
  name,
  url,
  description,
  addressLocality,
  addressRegion,
  postalCode,
  streetAddress,
  telephone,
  courtType,
}: LegalServiceSchemaProps) {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'LegalService',
    name,
    url,
  }

  if (description) schema.description = description
  if (telephone) schema.telephone = telephone
  if (courtType) schema.serviceType = courtType

  if (addressLocality || streetAddress) {
    schema.address = {
      '@type': 'PostalAddress',
      ...(streetAddress ? { streetAddress } : {}),
      ...(addressLocality ? { addressLocality } : {}),
      ...(addressRegion ? { addressRegion } : {}),
      ...(postalCode ? { postalCode } : {}),
      addressCountry: 'HR',
    }
  }

  return schema
}

export function articleSchema({
  headline,
  url,
  datePublished,
  dateModified,
  description,
  imageUrl,
  authorName,
}: ArticleSchemaProps) {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline,
    url,
    datePublished,
    dateModified: dateModified ?? datePublished,
    inLanguage: 'hr',
    publisher: {
      '@type': 'Organization',
      name: 'Sudačka Mreža',
      url: 'https://sudacka-mreza.hr',
    },
  }

  if (description) schema.description = description

  if (imageUrl) {
    schema.image = {
      '@type': 'ImageObject',
      url: imageUrl,
    }
  }

  if (authorName) {
    schema.author = {
      '@type': 'Person',
      name: authorName,
    }
  }

  return schema
}

export function personSchema({
  name,
  url,
  jobTitle,
  description,
  specialty,
  telephone,
  email,
  addressLocality,
}: PersonSchemaProps) {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name,
    url,
  }

  if (jobTitle) schema.jobTitle = jobTitle
  if (description) schema.description = description
  if (telephone) schema.telephone = telephone
  if (email) schema.email = email

  if (specialty) {
    schema.hasOccupation = {
      '@type': 'Occupation',
      name: specialty,
    }
  }

  if (addressLocality) {
    schema.address = {
      '@type': 'PostalAddress',
      addressLocality,
      addressCountry: 'HR',
    }
  }

  return schema
}

// ─── Component ────────────────────────────────────────────────────────────────

interface StructuredDataProps {
  schema: Record<string, unknown>
}

export default function StructuredData({ schema }: StructuredDataProps) {
  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(schema, null, 2)}</script>
    </Helmet>
  )
}
