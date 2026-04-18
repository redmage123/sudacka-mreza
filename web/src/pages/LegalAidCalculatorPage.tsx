import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Breadcrumb } from '@/components/ui/Breadcrumb'

const INCOME_THRESHOLD_SINGLE = 3_326  // HRK/EUR threshold per person
const INCOME_THRESHOLD_HOUSEHOLD = 2_660  // per additional member

export default function LegalAidCalculatorPage() {
  const { t } = useTranslation('common')
  const { t: tn } = useTranslation('nav')
  const { lang } = useParams<{ lang: string }>()
  const locale = lang ?? 'hr'
  usePageTitle('legalAidCalc')

  const [income, setIncome] = useState('')
  const [householdSize, setHouseholdSize] = useState('1')
  const [caseType, setCaseType] = useState('civil')
  const [result, setResult] = useState<null | { eligible: boolean; reason: string; office: string }>(null)

  const COUNTY_OFFICES: Record<string, string> = {
    zagreb: 'Ured za besplatnu pravnu pomoć, Ulica grada Vukovara 49, Zagreb, +385 1 6109 100',
    split: 'Ured za besplatnu pravnu pomoć, Domovinskog rata 2, Split, +385 21 329 329',
    rijeka: 'Ured za besplatnu pravnu pomoć, Slogin Kula 2, Rijeka, +385 51 354 100',
    osijek: 'Ured za besplatnu pravnu pomoć, Europska avenija 11, Osijek, +385 31 224 224',
    zadar: 'Ured za besplatnu pravnu pomoć, Ul. Dr. F. Tuđmana 24, Zadar, +385 23 250 250',
  }

  const [county, setCounty] = useState('zagreb')

  const calculate = () => {
    const monthlyIncome = parseFloat(income)
    if (isNaN(monthlyIncome) || monthlyIncome < 0) return

    const members = parseInt(householdSize) || 1
    const threshold = INCOME_THRESHOLD_SINGLE + (members - 1) * INCOME_THRESHOLD_HOUSEHOLD

    const eligible = monthlyIncome <= threshold
    const office = COUNTY_OFFICES[county] || COUNTY_OFFICES.zagreb

    setResult({
      eligible,
      reason: eligible
        ? t('legalAidCalc.eligibleReason', { threshold: threshold.toLocaleString(locale), income: monthlyIncome.toLocaleString(locale) })
        : t('legalAidCalc.ineligibleReason', { threshold: threshold.toLocaleString(locale), income: monthlyIncome.toLocaleString(locale) }),
      office,
    })
  }

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumb items={[
        { label: tn('home'), href: `/${locale}` },
        { label: tn('legalAid'), href: `/${locale}/slobodna-pravna-pomoc` },
        { label: t('legalAidCalc.title', 'Eligibility Calculator') },
      ]} />

      <h1 className="text-3xl font-bold text-[color:var(--color-heading)] dark:text-[color:var(--color-brand-gold)] mb-4 mt-6">
        {t('legalAidCalc.title', 'Legal Aid Eligibility Calculator')}
      </h1>
      <p className="text-[color:var(--color-text-muted)] mb-6">
        {t('legalAidCalc.description', 'Check if you qualify for free legal aid in Croatia based on your income and household size.')}
      </p>

      <div className="bg-[color:var(--color-surface)] dark:bg-[color:var(--color-surface-dark)] border border-[color:var(--color-border)] rounded-lg p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">{t('legalAidCalc.monthlyIncome', 'Monthly household income (EUR)')}</label>
          <input type="number" value={income} onChange={e => setIncome(e.target.value)} min="0" step="50"
            className="w-full rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-bg)] dark:bg-[color:var(--color-surface-dark)] px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t('legalAidCalc.householdSize', 'Household members')}</label>
          <select value={householdSize} onChange={e => setHouseholdSize(e.target.value)}
            className="w-full rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-bg)] dark:bg-[color:var(--color-surface-dark)] px-3 py-2">
            {[1,2,3,4,5,6,7,8].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t('legalAidCalc.caseType', 'Case type')}</label>
          <select value={caseType} onChange={e => setCaseType(e.target.value)}
            className="w-full rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-bg)] dark:bg-[color:var(--color-surface-dark)] px-3 py-2">
            <option value="civil">{t('courts.types.civil', 'Civil')}</option>
            <option value="criminal">{t('courts.types.criminal', 'Criminal')}</option>
            <option value="administrative">{t('courts.types.administrative', 'Administrative')}</option>
            <option value="labor">{t('legalAidCalc.labor', 'Labor')}</option>
            <option value="family">{t('legalAidCalc.family', 'Family')}</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t('legalAidCalc.county', 'County / City')}</label>
          <select value={county} onChange={e => setCounty(e.target.value)}
            className="w-full rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-bg)] dark:bg-[color:var(--color-surface-dark)] px-3 py-2">
            {Object.keys(COUNTY_OFFICES).map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
          </select>
        </div>
        <button onClick={calculate}
          className="w-full rounded-md bg-[color:var(--color-brand-navy)] text-white py-2.5 font-medium hover:opacity-90">
          {t('legalAidCalc.calculate', 'Check Eligibility')}
        </button>
      </div>

      {result && (
        <div className={`mt-6 rounded-lg p-6 border ${result.eligible
          ? 'bg-[color:var(--color-success-bg)] border-[color:var(--color-success)]'
          : 'bg-[color:var(--color-error-bg)] border-[color:var(--color-error)]'}`}>
          <h2 className="text-xl font-bold mb-2">
            {result.eligible ? t('legalAidCalc.eligible', 'You may qualify for free legal aid') : t('legalAidCalc.ineligible', 'You likely do not qualify')}
          </h2>
          <p className="mb-3">{result.reason}</p>
          {result.eligible && (
            <div className="mt-4 p-3 bg-white/50 dark:bg-black/20 rounded">
              <p className="font-medium text-sm">{t('legalAidCalc.nearestOffice', 'Nearest legal aid office:')}</p>
              <p className="text-sm mt-1">{result.office}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
