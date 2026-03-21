import { useTranslation } from 'react-i18next'

/**
 * Accessibility skip link — first focusable element on every page.
 * Visible only on keyboard focus; jumps to #main-content.
 */
export function SkipLink() {
  const { t } = useTranslation('nav')

  return (
    <a
      href="#main-content"
      className="skip-link"
    >
      {t('skipToContent')}
    </a>
  )
}
