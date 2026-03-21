/**
 * RootLayout — thin re-export of AppShell.
 *
 * The implementation lives in AppShell.tsx (same directory).
 * RootLayout exists as the canonical name per the sprint brief;
 * router.tsx uses AppShell directly for historical reasons — both
 * names refer to the same component.
 */
export { AppShell as RootLayout } from '@/components/layout/AppShell'
