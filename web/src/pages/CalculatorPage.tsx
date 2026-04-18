import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { useParams } from 'react-router'

type CaseType = 'civil' | 'criminal' | 'commercial' | 'administrative' | 'nonContentious'

interface FeeResult {
  filing: number
  appeal: number | null
  enforcement: number | null
}

function calculateFee(caseType: CaseType, claimValue: number): FeeResult {
  switch (caseType) {
    case 'civil': {
      const raw = claimValue * 0.01
      const filing = Math.min(Math.max(raw, 13.27), 663.61)
      const appeal = filing
      const enforcement = Math.min(Math.max(claimValue * 0.005, 9.29), 663.61)
      return { filing, appeal, enforcement }
    }
    case 'commercial': {
      const raw = claimValue * 0.015
      const filing = Math.min(Math.max(raw, 26.54), 1327.23)
      const appeal = filing
      const enforcement = Math.min(Math.max(claimValue * 0.005, 9.29), 1327.23)
      return { filing, appeal, enforcement }
    }
    case 'criminal':
      return { filing: 6.64, appeal: 66.36, enforcement: null }
    case 'administrative':
      return { filing: 13.27, appeal: null, enforcement: null }
    case 'nonContentious':
      return { filing: 13.27, appeal: 66.36, enforcement: null }
  }
}

const CASE_TYPES: Array<{ value: CaseType; labelKey: string }> = [
  { value: 'civil', labelKey: 'calculator.caseType.civil' },
  { value: 'criminal', labelKey: 'calculator.caseType.criminal' },
  { value: 'commercial', labelKey: 'calculator.caseType.commercial' },
  { value: 'administrative', labelKey: 'calculator.caseType.administrative' },
  { value: 'nonContentious', labelKey: 'calculator.caseType.nonContentious' },
]

export default function CalculatorPage() {
  const { t } = useTranslation('common')
  const { lang } = useParams<{ lang: string }>()
  const locale = lang ?? 'hr'
  usePageTitle('calculator')

  const [caseType, setCaseType] = useState<CaseType>('civil')
  const [claimValue, setClaimValue] = useState('')

  const needsClaimValue = caseType === 'civil' || caseType === 'commercial'
  const numericValue = parseFloat(claimValue) || 0

  const result = useMemo<FeeResult | null>(() => {
    if (needsClaimValue && numericValue <= 0) return null
    return calculateFee(caseType, numericValue)
  }, [caseType, numericValue, needsClaimValue])

  const fixedResult = useMemo<FeeResult | null>(() => {
    if (!needsClaimValue) return calculateFee(caseType, 0)
    return null
  }, [caseType, needsClaimValue])

  const displayResult = result ?? fixedResult

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumb
        items={[
          { label: t('nav.home'), href: `/${locale}` },
          { label: t('calculator.title') },
        ]}
        className="mb-6"
      />

      <h1 className="text-3xl font-bold text-[color:var(--color-heading)] mb-2">
        {t('calculator.title')}
      </h1>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-6">
          {/* Case type selector */}
          <div>
            <label htmlFor="caseType" className="block text-sm font-medium text-[color:var(--color-heading)] mb-2">
              {t('calculator.selectCaseType')}
            </label>
            <select
              id="caseType"
              value={caseType}
              onChange={(e) => setCaseType(e.target.value as CaseType)}
              className="w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-2.5 text-[color:var(--color-text)] focus:outline-2 focus:outline-[color:var(--color-border-focus)]"
            >
              {CASE_TYPES.map((ct) => (
                <option key={ct.value} value={ct.value}>
                  {t(ct.labelKey)}
                </option>
              ))}
            </select>
          </div>

          {/* Claim value input */}
          {needsClaimValue && (
            <div>
              <label htmlFor="claimValue" className="block text-sm font-medium text-[color:var(--color-heading)] mb-2">
                {t('calculator.claimValue')}
              </label>
              <div className="relative">
                <input
                  id="claimValue"
                  type="number"
                  min="0"
                  step="0.01"
                  value={claimValue}
                  onChange={(e) => setClaimValue(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-2.5 pr-12 text-[color:var(--color-text)] focus:outline-2 focus:outline-[color:var(--color-border-focus)]"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[color:var(--color-text-muted)] text-sm">
                  EUR
                </span>
              </div>
            </div>
          )}

          {/* Fixed fee table for criminal/administrative/nonContentious */}
          {!needsClaimValue && (
            <div className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-bg-card)] p-6">
              <h2 className="text-lg font-semibold text-[color:var(--color-heading)] mb-4">
                {t('calculator.fixedFee')}
              </h2>
              {caseType === 'criminal' && (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between py-1 border-b border-[color:var(--color-border)]">
                    <span className="text-[color:var(--color-text-muted)]">{t('calculator.minorOffenses')}</span>
                    <span className="font-medium text-[color:var(--color-heading)]">€6.64</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[color:var(--color-border)]">
                    <span className="text-[color:var(--color-text-muted)]">{t('calculator.seriousOffenses')}</span>
                    <span className="font-medium text-[color:var(--color-heading)]">€13.27 – €66.36</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-[color:var(--color-text-muted)]">{t('calculator.appealFee')}</span>
                    <span className="font-medium text-[color:var(--color-heading)]">€66.36</span>
                  </div>
                </div>
              )}
              {caseType === 'administrative' && (
                <div className="flex justify-between py-1">
                  <span className="text-[color:var(--color-text-muted)]">{t('calculator.caseType.administrative')}</span>
                  <span className="font-medium text-[color:var(--color-heading)]">€13.27</span>
                </div>
              )}
              {caseType === 'nonContentious' && (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between py-1 border-b border-[color:var(--color-border)]">
                    <span className="text-[color:var(--color-text-muted)]">{t('calculator.filingFee')}</span>
                    <span className="font-medium text-[color:var(--color-heading)]">€13.27</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-[color:var(--color-text-muted)]">{t('calculator.appealFee')}</span>
                    <span className="font-medium text-[color:var(--color-heading)]">€66.36</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Result for civil/commercial */}
          {displayResult && needsClaimValue && (
            <div className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-bg-card)] p-6 space-y-3">
              <h2 className="text-lg font-semibold text-[color:var(--color-heading)]">
                {t('calculator.filingFee')}
              </h2>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-[color:var(--color-text-muted)]">{t('calculator.filingFee')}</span>
                  <span className="font-semibold text-[color:var(--color-heading)]">
                    {displayResult.filing.toFixed(2)} EUR
                  </span>
                </div>
                {displayResult.appeal !== null && (
                  <div className="flex justify-between">
                    <span className="text-[color:var(--color-text-muted)]">{t('calculator.appealFee')}</span>
                    <span className="font-semibold text-[color:var(--color-heading)]">
                      {displayResult.appeal.toFixed(2)} EUR
                    </span>
                  </div>
                )}
                {displayResult.enforcement !== null && (
                  <div className="flex justify-between">
                    <span className="text-[color:var(--color-text-muted)]">{t('calculator.enforcementFee')}</span>
                    <span className="font-semibold text-[color:var(--color-heading)]">
                      {displayResult.enforcement.toFixed(2)} EUR
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Info panels */}
        <div className="space-y-6">
          {/* Exemptions */}
          <div className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-bg-card)] p-6">
            <h2 className="text-lg font-semibold text-[color:var(--color-heading)] mb-4">
              {t('calculator.exemptionsTitle')}
            </h2>
            <ul className="space-y-2 text-sm text-[color:var(--color-text)]">
              <li className="flex gap-2">
                <span className="text-[color:var(--color-primary)] mt-0.5">&#x2022;</span>
                {t('calculator.exemption1')}
              </li>
              <li className="flex gap-2">
                <span className="text-[color:var(--color-primary)] mt-0.5">&#x2022;</span>
                {t('calculator.exemption2')}
              </li>
              <li className="flex gap-2">
                <span className="text-[color:var(--color-primary)] mt-0.5">&#x2022;</span>
                {t('calculator.exemption3')}
              </li>
            </ul>
          </div>

          {/* Payment methods */}
          <div className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-bg-card)] p-6">
            <h2 className="text-lg font-semibold text-[color:var(--color-heading)] mb-4">
              {t('calculator.paymentTitle')}
            </h2>
            <ul className="space-y-2 text-sm text-[color:var(--color-text)]">
              <li className="flex gap-2">
                <span className="text-[color:var(--color-primary)] mt-0.5">&#x2022;</span>
                {t('calculator.payment1')}
              </li>
              <li className="flex gap-2">
                <span className="text-[color:var(--color-primary)] mt-0.5">&#x2022;</span>
                {t('calculator.payment2')}
              </li>
              <li className="flex gap-2">
                <span className="text-[color:var(--color-primary)] mt-0.5">&#x2022;</span>
                {t('calculator.payment3')}
              </li>
            </ul>
          </div>

          {/* Legal basis */}
          <div className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-bg-card)] p-6">
            <h2 className="text-lg font-semibold text-[color:var(--color-heading)] mb-2">
              {t('calculator.legalBasis')}
            </h2>
            <p className="text-sm text-[color:var(--color-text-muted)]">
              {t('calculator.legalBasisText')}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
