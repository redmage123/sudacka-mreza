/**
 * MetaTags — dynamic <title>, <meta>, Open Graph, and Twitter Card tags
 * via react-helmet-async.
 *
 * Croatian is the default language; pass `lang="en"` for English pages.
 *
 * Usage:
 *   <MetaTags
 *     title="Sudovi — Sudačka Mreža"
 *     description="Pretraži sve sudove u Republici Hrvatskoj."
 *     canonicalPath="/hr/sudovi"
 *   />
 *
 *   <MetaTags
 *     title="Zagreb County Court"
 *     description="Official records and decisions for Zagreb County Court."
 *     lang="en"
 *     canonicalPath="/en/courts/123-zupanijski-sud-zagreb"
 *     ogImage="/assets/coat-of-arms-zagreb.png"
 *     ogType="website"
 *   />
 */

import { Helmet } from 'react-helmet-async'

const SITE_NAME = 'Sudačka Mreža'
const BASE_URL = 'https://sudacka-mreza.hr'
const DEFAULT_OG_IMAGE = `${BASE_URL}/assets/sudacka-mreza-logo.gif`
const THEME_COLOR = '#0D2B55'

export interface MetaTagsProps {
  /** Page title — the suffix " — Sudačka Mreža" is appended automatically unless you set `appendSiteName={false}` */
  title: string
  /** Meta description (ideally 50–160 chars) */
  description: string
  /** Canonical URL path, e.g. "/hr/sudovi/123-naziv-suda". Do not include the base URL. */
  canonicalPath?: string
  /** Open Graph / Twitter image URL. Defaults to the Sudačka Mreža logo. */
  ogImage?: string
  /** Open Graph type. Defaults to "website". Use "article" for news posts. */
  ogType?: 'website' | 'article'
  /** Page language code. Defaults to "hr". */
  lang?: 'hr' | 'en'
  /** Set to false to suppress " — Sudačka Mreža" suffix on the title. */
  appendSiteName?: boolean
  /** ISO 8601 date string — used for article:published_time */
  datePublished?: string
  /** ISO 8601 date string — used for article:modified_time */
  dateModified?: string
  /** Robots directive. Defaults to "index, follow". */
  robots?: string
  /** hreflang alternate path for the other language version, e.g. "/en/courts/123" */
  alternateLangPath?: string
}

export default function MetaTags({
  title,
  description,
  canonicalPath,
  ogImage = DEFAULT_OG_IMAGE,
  ogType = 'website',
  lang = 'hr',
  appendSiteName = true,
  datePublished,
  dateModified,
  robots = 'index, follow',
  alternateLangPath,
}: MetaTagsProps) {
  const fullTitle = appendSiteName ? `${title} — ${SITE_NAME}` : title
  const canonicalUrl = canonicalPath ? `${BASE_URL}${canonicalPath}` : BASE_URL
  const ogImageUrl = ogImage.startsWith('http') ? ogImage : `${BASE_URL}${ogImage}`

  // The alternate language is whichever is not `lang`
  const alternateLang = lang === 'hr' ? 'en' : 'hr'
  const alternateUrl = alternateLangPath
    ? `${BASE_URL}${alternateLangPath}`
    : null

  return (
    <Helmet>
      {/* Primary */}
      <html lang={lang} />
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="robots" content={robots} />
      <meta name="theme-color" content={THEME_COLOR} />

      {/* Canonical */}
      {canonicalPath && <link rel="canonical" href={canonicalUrl} />}

      {/* hreflang — self */}
      {canonicalPath && (
        <link rel="alternate" hrefLang={lang} href={canonicalUrl} />
      )}

      {/* hreflang — other language */}
      {alternateUrl && (
        <link rel="alternate" hrefLang={alternateLang} href={alternateUrl} />
      )}

      {/* hreflang — x-default points to Croatian (primary language) */}
      {canonicalPath && lang === 'hr' && (
        <link rel="alternate" hrefLang="x-default" href={canonicalUrl} />
      )}
      {alternateUrl && lang === 'en' && (
        <link rel="alternate" hrefLang="x-default" href={alternateUrl} />
      )}

      {/* Open Graph */}
      <meta property="og:type" content={ogType} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:image" content={ogImageUrl} />
      <meta property="og:image:alt" content={`${SITE_NAME} — logo`} />
      <meta property="og:locale" content={lang === 'hr' ? 'hr_HR' : 'en_GB'} />

      {/* Article-specific OG tags */}
      {ogType === 'article' && datePublished && (
        <meta property="article:published_time" content={datePublished} />
      )}
      {ogType === 'article' && dateModified && (
        <meta property="article:modified_time" content={dateModified} />
      )}

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImageUrl} />
    </Helmet>
  )
}
