import type { Access, FieldAccess } from 'payload'

/** Full access for admins only */
export const isAdmin: Access = ({ req }) => req.user?.role === 'admin'

/** Access for admins and editors */
export const isAdminOrEditor: Access = ({ req }) =>
  req.user?.role === 'admin' || req.user?.role === 'editor'

/**
 * Access for admins, editors, and legal entities (pravne osobe).
 * Used where a registered legal entity acts on its own behalf — e.g.
 * submitting bankruptcy filings — alongside internal-staff roles.
 */
export const isLegalEntityOrAbove: Access = ({ req }) =>
  req.user?.role === 'admin' ||
  req.user?.role === 'editor' ||
  req.user?.role === 'legal_entity'

/** Unrestricted public read */
export const publicRead: Access = () => true

/** Field-level: visible to logged-in users (members) only */
export const membersOnlyRead: FieldAccess = ({ req }) => Boolean(req.user)
