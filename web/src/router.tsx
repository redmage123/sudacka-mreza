import { Navigate, createBrowserRouter } from 'react-router'
import { AppShell } from '@/components/layout/AppShell'
import { ChunkErrorBoundary } from '@/components/ChunkErrorBoundary'
import RouterErrorPage from '@/pages/RouterErrorPage'

// Pages — lazy-loaded for performance
import { lazy, Suspense } from 'react'

// --- Page imports ---
const HomePage = lazy(() => import('@/pages/HomePage'))
const GlobalSearchPage = lazy(() => import('@/pages/GlobalSearchPage'))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'))

// Case law
const DecisionsSearchPage = lazy(() => import('@/pages/decisions/DecisionsSearchPage'))
const DecisionDetailPage = lazy(() => import('@/pages/decisions/DecisionDetailPage'))
const VTSDecisionsPage = lazy(() => import('@/pages/decisions/VTSDecisionsPage'))
const ESLJPDecisionsPage = lazy(() => import('@/pages/decisions/ESLJPDecisionsPage'))
const ECJDecisionsPage = lazy(() => import('@/pages/decisions/ECJDecisionsPage'))
const EurLexSearchPage = lazy(() => import('@/pages/EurLexSearchPage'))

// Experts
const ExpertsPage = lazy(() => import('@/pages/experts/ExpertsPage'))
const ExpertDetailPage = lazy(() => import('@/pages/experts/ExpertDetailPage'))
const InterpretersPage = lazy(() => import('@/pages/experts/InterpretersPage'))
const InterpreterDetailPage = lazy(() => import('@/pages/experts/InterpreterDetailPage'))

// Courts
const CourtsPage = lazy(() => import('@/pages/courts/CourtsPage'))
const CourtDetailPage = lazy(() => import('@/pages/courts/CourtDetailPage'))
const CourtPerformancePage = lazy(() => import('@/pages/courts/CourtPerformancePage'))
const StateAttorneysPage = lazy(() => import('@/pages/courts/StateAttorneysPage'))
const JurisdictionFinderPage = lazy(() => import('@/pages/courts/JurisdictionFinderPage'))
const JudgesPage = lazy(() => import('@/pages/courts/JudgesPage'))
const JudgeDetailPage = lazy(() => import('@/pages/courts/JudgeDetailPage'))

// Bankruptcy
const BankruptcyPage = lazy(() => import('@/pages/bankruptcy/BankruptcyPage'))
const BankruptcyListingsPage = lazy(() => import('@/pages/bankruptcy/BankruptcyListingsPage'))
const BankruptcyListingDetailPage = lazy(() => import('@/pages/bankruptcy/BankruptcyListingDetailPage'))
const AdministratorsPage = lazy(() => import('@/pages/bankruptcy/AdministratorsPage'))
const BankruptcyLawsPage = lazy(() => import('@/pages/bankruptcy/BankruptcyLawsPage'))
const BankruptcyDecisionsPage = lazy(() => import('@/pages/bankruptcy/BankruptcyDecisionsPage'))

// Static pages
const CalculatorPage = lazy(() => import('@/pages/CalculatorPage'))
const DeadlineCalculatorPage = lazy(() => import('@/pages/DeadlineCalculatorPage'))
const LegalAidPage = lazy(() => import('@/pages/LegalAidPage'))
const AboutPage = lazy(() => import('@/pages/AboutPage'))
const ContactPage = lazy(() => import('@/pages/ContactPage'))

// Gallery
const GalleriesPage = lazy(() => import('@/pages/GalleriesPage'))
const GalleryDetailPage = lazy(() => import('@/pages/GalleryDetailPage'))

// Map
const MapPage = lazy(() => import('@/pages/MapPage'))

// News
const NewsPage = lazy(() => import('@/pages/NewsPage'))
const NewsDetailPage = lazy(() => import('@/pages/NewsDetailPage'))
const LegalNewsPage = lazy(() => import('@/pages/LegalNewsPage'))

// Statistics
const StatisticsPage = lazy(() => import('@/pages/StatisticsPage'))

// API Docs
const ApiDocsPage = lazy(() => import('@/pages/ApiDocsPage'))

// Documents & Media
const DocumentsPage = lazy(() => import('@/pages/DocumentsPage'))
const DocumentGeneratorPage = lazy(() => import('@/pages/DocumentGeneratorPage'))
const MediaPage = lazy(() => import('@/pages/MediaPage'))

// Members / auth
const MembersPage = lazy(() => import('@/pages/MembersPage'))
const LoginPage = lazy(() => import('@/pages/LoginPage'))
const RegisterPage = lazy(() => import('@/pages/RegisterPage'))
const MyLibraryPage = lazy(() => import('@/pages/MyLibraryPage'))

const WatchlistPage = lazy(() => import('@/pages/WatchlistPage'))
const LegalAidCalculatorPage = lazy(() => import('@/pages/LegalAidCalculatorPage'))

// GDPR / legal
const PrivacyPolicyPage = lazy(() => import('@/pages/PrivacyPolicyPage'))
const CookiePolicyPage = lazy(() => import('@/pages/CookiePolicyPage'))

const TermsPage = lazy(() => import('@/pages/TermsPage'))

// Admin
const AdminLayout = lazy(() => import('@/pages/admin/AdminLayout'))
const AdminDashboardPage = lazy(() => import('@/pages/admin/AdminDashboardPage'))
const AdminUsersPage = lazy(() => import('@/pages/admin/AdminUsersPage'))
const AdminBankruptcyPage = lazy(() => import('@/pages/admin/AdminBankruptcyPage'))
const AdminGdprPage = lazy(() => import('@/pages/admin/AdminGdprPage'))
const AdminFlagsPage = lazy(() => import('@/pages/admin/AdminFlagsPage'))
const AdminNewsPage = lazy(() => import('@/pages/admin/AdminNewsPage'))
const AdminMediaPage = lazy(() => import('@/pages/admin/AdminMediaPage'))
const AdminGlobalsPage = lazy(() => import('@/pages/admin/AdminGlobalsPage'))
const AdminAuditLogPage = lazy(() => import('@/pages/admin/AdminAuditLogPage'))
const AdminCollectionCourtsPage       = lazy(() => import('@/pages/admin/collections/CourtsPage'))
const AdminCollectionJudgesPage       = lazy(() => import('@/pages/admin/collections/JudgesPage'))
const AdminCollectionExpertsPage      = lazy(() => import('@/pages/admin/collections/ExpertsPage'))
const AdminCollectionInterpretersPage = lazy(() => import('@/pages/admin/collections/InterpretersPage'))
const AdminCollectionStateAttorneysPage = lazy(() => import('@/pages/admin/collections/StateAttorneysPage'))
const AdminCollectionBankruptcyAdminsPage = lazy(() => import('@/pages/admin/collections/BankruptcyAdministratorsPage'))
const AdminCollectionLawsPage         = lazy(() => import('@/pages/admin/collections/LawsPage'))
const AdminCollectionCategoriesPage   = lazy(() => import('@/pages/admin/collections/LegalCategoriesPage'))
const AdminCollectionDocumentsPage    = lazy(() => import('@/pages/admin/collections/DocumentsPage'))
const AdminCollectionPagesPage        = lazy(() => import('@/pages/admin/collections/PagesPage'))
const AdminCollectionApiKeysPage      = lazy(() => import('@/pages/admin/collections/ApiKeysPage'))
const AccountPage = lazy(() => import('@/pages/AccountPage'))

// Editor (data-entry)
const EditorLayout = lazy(() => import('@/pages/editor/EditorLayout'))
const EditorHomePage = lazy(() => import('@/pages/editor/EditorHomePage'))
const EditorIngestPage = lazy(() => import('@/pages/editor/EditorIngestPage'))
const EditorPendingPage = lazy(() => import('@/pages/editor/EditorPendingPage'))
const BankruptcyFilingsIndex = lazy(() => import('@/pages/editor/BankruptcyFilingsIndex'))
const FilingFormPage = lazy(() => import('@/pages/editor/FilingFormPage'))
const AdminFilingsPage = lazy(() => import('@/pages/admin/AdminFilingsPage'))

// Helper — wraps lazy page in ChunkErrorBoundary + Suspense.
// ChunkErrorBoundary auto-reloads on stale chunk errors (post-deploy hash mismatch).
function S(Page: React.LazyExoticComponent<React.ComponentType>) {
  return (
    <ChunkErrorBoundary>
      <Suspense fallback={<div className="flex h-64 items-center justify-center text-[color:var(--color-text-muted)]" aria-busy="true" />}>
        <Page />
      </Suspense>
    </ChunkErrorBoundary>
  )
}

export const router = createBrowserRouter([
  // Redirect bare root to default language
  {
    path: '/',
    element: <Navigate to="/hr" replace />,
    errorElement: <RouterErrorPage />,
  },

  // Language-prefixed app shell
  {
    path: '/:lang',
    element: <AppShell />,
    errorElement: <RouterErrorPage />,
    children: [
      // Home
      { index: true, element: S(HomePage) },

      // Global search
      { path: 'pretraga', element: S(GlobalSearchPage) },

      // Case law
      { path: 'sudska-praksa/pretraga', element: S(DecisionsSearchPage) },
      { path: 'sudska-praksa/vts', element: S(VTSDecisionsPage) },
      { path: 'sudska-praksa/esljp', element: S(ESLJPDecisionsPage) },
      { path: 'sudska-praksa/ecj', element: S(ECJDecisionsPage) },
      { path: 'eur-lex', element: S(EurLexSearchPage) },
      { path: 'sudska-praksa/:id', element: S(DecisionDetailPage) },

      // Experts
      { path: 'strucnjaci/vjestaci', element: S(ExpertsPage) },
      { path: 'strucnjaci/vjestaci/:id', element: S(ExpertDetailPage) },
      { path: 'strucnjaci/tumaci', element: S(InterpretersPage) },
      { path: 'strucnjaci/tumaci/:id', element: S(InterpreterDetailPage) },

      // Courts
      { path: 'sudovi', element: S(CourtsPage) },
      { path: 'sudovi/dorh', element: S(StateAttorneysPage) },
      { path: 'sudovi/suci', element: S(JudgesPage) },
      { path: 'sudovi/suci/:id', element: S(JudgeDetailPage) },
      { path: 'sudovi/nadleznost', element: S(JurisdictionFinderPage) },
      { path: 'sudovi/performanse', element: S(CourtPerformancePage) },
      { path: 'nadleznost', element: S(JurisdictionFinderPage) },
      { path: 'sudovi/:id', element: S(CourtDetailPage) },

      // Bankruptcy
      { path: 'stecaj', element: S(BankruptcyPage) },
      { path: 'stecaj/oglasi', element: S(BankruptcyListingsPage) },
      { path: 'stecaj/oglasi/:id', element: S(BankruptcyListingDetailPage) },
      { path: 'stecaj/upravitelji', element: S(AdministratorsPage) },
      { path: 'stecaj/zakoni', element: S(BankruptcyLawsPage) },
      { path: 'stecaj/zakonodavstvo', element: S(BankruptcyLawsPage) },
      { path: 'stecaj/odluke', element: S(BankruptcyDecisionsPage) },

      // Statistics
      { path: 'statistika', element: S(StatisticsPage) },

      // Public API docs
      { path: 'api', element: S(ApiDocsPage) },

      // Calculator & static
      { path: 'pristojbe', element: S(CalculatorPage) },
      { path: 'rokovi', element: S(DeadlineCalculatorPage) },
      { path: 'pravna-pomoc', element: S(LegalAidPage) },
      { path: 'slobodna-pravna-pomoc', element: S(LegalAidPage) },
      { path: 'o-nama', element: S(AboutPage) },
      { path: 'kontakt', element: S(ContactPage) },

      // GDPR / legal pages
      { path: 'privatnost', element: S(PrivacyPolicyPage) },
      { path: 'kolacici', element: S(CookiePolicyPage) },
      { path: 'uvjeti', element: S(TermsPage) },

      // Map (AC-2 required route) + Croatian alias
      { path: 'mapa', element: S(MapPage) },
      { path: 'mapa-sudova', element: S(MapPage) },

      // Gallery
      { path: 'galerije', element: S(GalleriesPage) },
      { path: 'galerije/:id', element: S(GalleryDetailPage) },

      // News
      { path: 'vijesti', element: S(NewsPage) },
      { path: 'vijesti/:slug', element: S(NewsDetailPage) },
      { path: 'novosti', element: S(NewsPage) },
      { path: 'novosti/pravne-vijesti', element: S(LegalNewsPage) },

      // Documents & Media
      { path: 'dokumenti', element: S(DocumentsPage) },
      { path: 'dokumenti/generator', element: S(DocumentGeneratorPage) },
      { path: 'mediji', element: S(MediaPage) },

      // Members / auth
      { path: 'clanovi', element: S(MembersPage) },
      { path: 'login', element: S(LoginPage) },
      { path: 'prijava', element: S(LoginPage) },
      { path: 'register', element: S(RegisterPage) },
      { path: 'registracija', element: S(RegisterPage) },
      { path: 'moja-knjiznica', element: S(MyLibraryPage) },

      { path: 'pracenje', element: S(WatchlistPage) },
      { path: 'pravna-pomoc/kalkulator', element: S(LegalAidCalculatorPage) },
      { path: 'slobodna-pravna-pomoc/kalkulator', element: S(LegalAidCalculatorPage) },

      // Admin area — role-gated in AdminLayout
      {
        path: 'admin',
        element: S(AdminLayout),
        children: [
          { index: true, element: S(AdminDashboardPage) },
          { path: 'users', element: S(AdminUsersPage) },
          { path: 'gdpr', element: S(AdminGdprPage) },
          { path: 'bankruptcy', element: S(AdminBankruptcyPage) },
          { path: 'flags', element: S(AdminFlagsPage) },
          { path: 'news', element: S(AdminNewsPage) },
          { path: 'media', element: S(AdminMediaPage) },
          { path: 'globals', element: S(AdminGlobalsPage) },
          { path: 'audit-log', element: S(AdminAuditLogPage) },
          { path: 'courts', element: S(AdminCollectionCourtsPage) },
          { path: 'judges', element: S(AdminCollectionJudgesPage) },
          { path: 'experts', element: S(AdminCollectionExpertsPage) },
          { path: 'interpreters', element: S(AdminCollectionInterpretersPage) },
          { path: 'state-attorneys', element: S(AdminCollectionStateAttorneysPage) },
          { path: 'bankruptcy-administrators', element: S(AdminCollectionBankruptcyAdminsPage) },
          { path: 'laws', element: S(AdminCollectionLawsPage) },
          { path: 'legal-categories', element: S(AdminCollectionCategoriesPage) },
          { path: 'documents', element: S(AdminCollectionDocumentsPage) },
          { path: 'pages', element: S(AdminCollectionPagesPage) },
          { path: 'api-keys', element: S(AdminCollectionApiKeysPage) },
          { path: 'filings', element: S(AdminFilingsPage) },
        ],
      },
      { path: 'moja-knjiznica/racun', element: S(AccountPage) },
      { path: 'racun', element: S(AccountPage) },

      // Editor area — data_editor / editor / admin roles
      {
        path: 'editor',
        element: S(EditorLayout),
        children: [
          { index: true, element: S(EditorHomePage) },
          { path: 'ingest', element: S(EditorIngestPage) },
          { path: 'pending', element: S(EditorPendingPage) },
          { path: 'bankruptcy', element: S(BankruptcyFilingsIndex) },
          { path: 'bankruptcy/:type', element: S(FilingFormPage) },
        ],
      },

      // 404 within lang prefix
      { path: '*', element: S(NotFoundPage) },
    ],
  },

  // Bare 404 fallback
  {
    path: '*',
    element: <Navigate to="/hr" replace />,
  },
])
