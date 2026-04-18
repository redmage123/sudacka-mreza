import { useEffect } from "react"
import { useTranslation } from "react-i18next"

export function usePageTitle(key: string, ns = "nav") {
  const { t } = useTranslation(ns)
  useEffect(() => {
    const label = t(key)
    document.title = label && label !== key ? `${label} — Sudačka Mreža` : "Sudačka Mreža"
  }, [key, t])
}
