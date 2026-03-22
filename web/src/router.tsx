import { Navigate, createBrowserRouter } from 'react-router'
import { AppShell } from '@/components/layout/AppShell'

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

// Experts
const ExpertsPage = lazy(() => import('@/pages/experts/ExpertsPage'))
const ExpertDetailPage = lazy(() => import('@/pages/experts/ExpertDetailPage'))
const InterpretersPage = lazy(() => import('@/pages/experts/InterpretersPage'))
const InterpreterDetailPage = lazy(() => import('@/pages/experts/InterpreterDetailPage'))

// Courts
const CourtsPage = lazy(() => import('@/pages/courts/CourtsPage'))
const CourtDetailPage = lazy(() => import('@/pages/courts/CourtDetailPage'))
const StateAttorneysPage = lazy(() => import('@/pages/courts/StateAttorneysPage'))
const JurisdictionFinderPage = lazy(() => import('@/pages/courts/JurisdictionFinderPage'))

// Bankruptcy
const BankruptcyPage = lazy(() => import('@/pages/bankruptcy/BankruptcyPage'))
const BankruptcyListingsPage = lazy(() => import('@/pages/bankruptcy/BankruptcyListingsPage'))
const BankruptcyListingDetailPage = lazy(() => import('@/pages/bankruptcy/BankruptcyListingDetailPage'))
const AdministratorsPage = lazy(() => import('@/pages/bankruptcy/AdministratorsPage'))
const BankruptcyLawsPage = lazy(() => import('@/pages/bankruptcy/BankruptcyLawsPage'))
const BankruptcyDecisionsPage = lazy(() => import('@/pages/bankruptcy/BankruptcyDecisionsPage'))

// Static pages
const CalculatorPage = lazy(() => import('@/pages/CalculatorPage'))
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

// Statistics
const StatisticsPage = lazy(() => import('@/pages/StatisticsPage'))

// Members / auth
const MembersPage = lazy(() => import('@/pages/MembersPage'))
const LoginPage = lazy(() => import('@/pages/LoginPage'))
const RegisterPage = lazy(() => import('@/pages/RegisterPage'))
const MyLibraryPage = lazy(() => import('@/pages/MyLibraryPage'))

// Helper to wrap in Suspense
function S(Page: React.LazyExoticComponent<React.ComponentType>) {
  return (
    <Suspense fallback={<div className="flex h-64 items-center justify-center text-[color:var(--color-text-muted)]" aria-busy="true" />}>
      <Page />
    </Suspense>
  )
}

export const router = createBrowserRouter([
  // Redirect bare root to default language
  {
    path: '/',
    element: <Navigate to="/hr" replace />,
  },

  // Language-prefixed app shell
  {
    path: '/:lang',
    element: <AppShell />,
    children: [
      // Home
      { index: true, element: S(HomePage) },

      // Global search
      { path: 'pretraga', element: S(GlobalSearchPage) },

      // Case law
      { path: 'sudska-praksa/pretraga', element: S(DecisionsSearchPage) },
      { path: 'sudska-praksa/vts', element: S(VTSDecisionsPage) },
      { path: 'sudska-praksa/esljp', element: S(ESLJPDecisionsPage) },
      { path: 'sudska-praksa/:id', element: S(DecisionDetailPage) },

      // Experts
      { path: 'strucnjaci/vjestaci', element: S(ExpertsPage) },
      { path: 'strucnjaci/vjestaci/:id', element: S(ExpertDetailPage) },
      { path: 'strucnjaci/tumaci', element: S(InterpretersPage) },
      { path: 'strucnjaci/tumaci/:id', element: S(InterpreterDetailPage) },

      // Courts
      { path: 'sudovi', element: S(CourtsPage) },
      { path: 'sudovi/dorh', element: S(StateAttorneysPage) },
      { path: 'sudovi/nadleznost', element: S(JurisdictionFinderPage) },
      { path: 'sudovi/:id', element: S(CourtDetailPage) },

      // Bankruptcy
      { path: 'stecaj', element: S(BankruptcyPage) },
      { path: 'stecaj/oglasi', element: S(BankruptcyListingsPage) },
      { path: 'stecaj/oglasi/:id', element: S(BankruptcyListingDetailPage) },
      { path: 'stecaj/upravitelji', element: S(AdministratorsPage) },
      { path: 'stecaj/zakoni', element: S(BankruptcyLawsPage) },
      { path: 'stecaj/odluke', element: S(BankruptcyDecisionsPage) },

      // Statistics
      { path: 'statistika', element: S(StatisticsPage) },

      // Calculator & static
      { path: 'pristojbe', element: S(CalculatorPage) },
      { path: 'pravna-pomoc', element: S(LegalAidPage) },
      { path: 'o-nama', element: S(AboutPage) },
      { path: 'kontakt', element: S(ContactPage) },

      // Map (AC-2 required route)
      { path: 'mapa', element: S(MapPage) },

      // Gallery
      { path: 'galerije', element: S(GalleriesPage) },
      { path: 'galerije/:id', element: S(GalleryDetailPage) },

      // News
      { path: 'vijesti', element: S(NewsPage) },
      { path: 'vijesti/:slug', element: S(NewsDetailPage) },

      // Members / auth
      { path: 'clanovi', element: S(MembersPage) },
      { path: 'login', element: S(LoginPage) },
      { path: 'register', element: S(RegisterPage) },
      { path: 'moja-knjiznica', element: S(MyLibraryPage) },

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
