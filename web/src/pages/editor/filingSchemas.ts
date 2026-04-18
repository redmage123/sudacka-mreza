// Schemas for Croatian bankruptcy trustee filings.
// Each filing is a domain form submitted during a bankruptcy proceeding.
// The generic FilingFormPage renders any of these based on the schema.

export type FieldType = 'text' | 'textarea' | 'number' | 'date' | 'select' | 'oib' | 'currency'

export interface FilingField {
  key: string
  label: string // English + Croatian pair, shown as-is
  type: FieldType
  required?: boolean
  rows?: number
  options?: Array<{ label: string; value: string }>
  hint?: string
}

export interface FilingSchema {
  type: string
  icon: string
  title: string // e.g. "Prijava tražbine / Creditor claim filing"
  description: string
  // Which fields are logically the "parent case" link — used for UI grouping.
  caseField?: string
  fields: FilingField[]
}

const OIB: FilingField = { key: 'debtor_oib', label: 'OIB (11 digits)', type: 'oib' }
const CASE: FilingField = { key: 'case_number', label: 'Broj predmeta / Case number', type: 'text', required: true, hint: 'e.g. St-1234/2025' }

export const FILING_SCHEMAS: Record<string, FilingSchema> = {
  'prijava-trazbine': {
    type: 'prijava-trazbine',
    icon: '💰',
    title: 'Prijava tražbine / Creditor claim filing',
    description: 'Submit a claim against a debtor\'s estate during bankruptcy proceedings.',
    caseField: 'case_number',
    fields: [
      CASE,
      { key: 'creditor_name', label: 'Vjerovnik / Creditor (name or company)', type: 'text', required: true },
      { key: 'creditor_oib', label: 'OIB vjerovnika / Creditor OIB', type: 'oib', required: true },
      { key: 'creditor_address', label: 'Adresa vjerovnika', type: 'text', required: true },
      { key: 'creditor_contact', label: 'Kontakt (email / phone)', type: 'text' },
      { key: 'debtor_name', label: 'Dužnik / Debtor', type: 'text', required: true },
      { key: 'claim_amount', label: 'Iznos tražbine / Claim amount (EUR)', type: 'currency', required: true },
      { key: 'claim_basis', label: 'Pravni temelj tražbine / Legal basis of claim', type: 'textarea', required: true, rows: 4 },
      { key: 'claim_priority', label: 'Isplatni razred / Priority class', type: 'select', required: true, options: [
        { label: 'Razlučni (Secured)',  value: 'secured' },
        { label: 'Prioritetni (Preferred)', value: 'preferred' },
        { label: 'Opći (General)', value: 'general' },
        { label: 'Podređeni (Subordinated)', value: 'subordinated' },
      ]},
      { key: 'supporting_docs', label: 'Priloženi dokazi / Supporting evidence', type: 'textarea', rows: 3 },
      { key: 'submission_date', label: 'Datum prijave / Filing date', type: 'date', required: true },
    ],
  },

  'trustee-report': {
    type: 'trustee-report',
    icon: '📑',
    title: 'Izvješće stečajnog upravitelja / Trustee\'s report',
    description: 'Periodic report from the trustee about the status of the proceedings.',
    caseField: 'case_number',
    fields: [
      CASE,
      { key: 'trustee_name', label: 'Stečajni upravitelj / Trustee name', type: 'text', required: true },
      { key: 'trustee_licence', label: 'Broj licence / Licence number', type: 'text' },
      { key: 'reporting_period_start', label: 'Razdoblje od / Period start', type: 'date', required: true },
      { key: 'reporting_period_end', label: 'Razdoblje do / Period end', type: 'date', required: true },
      { key: 'asset_status', label: 'Stanje imovine / Asset status', type: 'textarea', required: true, rows: 5 },
      { key: 'actions_taken', label: 'Poduzete radnje / Actions taken', type: 'textarea', required: true, rows: 5 },
      { key: 'estimated_distribution_eur', label: 'Procijenjena raspodjela (EUR)', type: 'currency' },
      { key: 'next_steps', label: 'Sljedeći koraci / Next steps', type: 'textarea', rows: 4 },
    ],
  },

  'asset-inventory': {
    type: 'asset-inventory',
    icon: '📋',
    title: 'Popis imovine / Asset inventory',
    description: 'Inventory of assets belonging to the bankruptcy estate.',
    caseField: 'case_number',
    fields: [
      CASE,
      { key: 'appraiser_name', label: 'Procjenitelj / Appraiser', type: 'text' },
      { key: 'appraisal_date', label: 'Datum procjene / Appraisal date', type: 'date', required: true },
      { key: 'real_estate', label: 'Nekretnine / Real estate (one per line: description, location, value)', type: 'textarea', rows: 5 },
      { key: 'movables', label: 'Pokretnine / Movable assets', type: 'textarea', rows: 5 },
      { key: 'receivables', label: 'Potraživanja / Receivables', type: 'textarea', rows: 4 },
      { key: 'other_rights', label: 'Ostala prava / Other rights', type: 'textarea', rows: 3 },
      { key: 'encumbrances', label: 'Tereti / Encumbrances', type: 'textarea', rows: 3 },
      { key: 'total_estimated_value_eur', label: 'Ukupna procijenjena vrijednost (EUR)', type: 'currency', required: true },
    ],
  },

  'distribution-proposal': {
    type: 'distribution-proposal',
    icon: '📊',
    title: 'Prijedlog diobe / Distribution proposal',
    description: 'Proposed distribution of estate proceeds to creditor classes.',
    caseField: 'case_number',
    fields: [
      CASE,
      { key: 'proposal_date', label: 'Datum prijedloga / Proposal date', type: 'date', required: true },
      { key: 'total_estate_eur', label: 'Ukupna stečajna masa (EUR)', type: 'currency', required: true },
      { key: 'secured_payout_eur', label: 'Razlučni razred — isplata (EUR)', type: 'currency' },
      { key: 'preferred_payout_eur', label: 'Prioritetni razred — isplata (EUR)', type: 'currency' },
      { key: 'general_payout_eur', label: 'Opći razred — isplata (EUR)', type: 'currency' },
      { key: 'general_payout_pct', label: 'Opći razred — postotak isplate (%)', type: 'number', hint: '0–100' },
      { key: 'subordinated_payout_eur', label: 'Podređeni razred — isplata (EUR)', type: 'currency' },
      { key: 'notes', label: 'Napomene / Notes', type: 'textarea', rows: 4 },
    ],
  },

  'final-accounting': {
    type: 'final-accounting',
    icon: '🧾',
    title: 'Konačni obračun / Final accounting',
    description: 'Final accounting of the estate at the close of proceedings.',
    caseField: 'case_number',
    fields: [
      CASE,
      { key: 'closing_date', label: 'Datum zaključenja / Closing date', type: 'date', required: true },
      { key: 'total_realisations_eur', label: 'Ukupno unovčeno / Total realisations (EUR)', type: 'currency', required: true },
      { key: 'total_expenses_eur', label: 'Ukupni troškovi / Total expenses (EUR)', type: 'currency', required: true },
      { key: 'total_distributions_eur', label: 'Ukupne isplate / Total distributions (EUR)', type: 'currency', required: true },
      { key: 'balance_returned_eur', label: 'Saldo vraćen / Balance returned (EUR)', type: 'currency' },
      { key: 'narrative', label: 'Opisni izvještaj / Narrative summary', type: 'textarea', rows: 6 },
    ],
  },

  'motion-to-open': {
    type: 'motion-to-open',
    icon: '⚖️',
    title: 'Prijedlog za otvaranje stečaja / Motion to open proceedings',
    description: 'Motion filed by a creditor or the debtor to open bankruptcy proceedings.',
    fields: [
      { key: 'filer_type', label: 'Podnositelj / Filer', type: 'select', required: true, options: [
        { label: 'Dužnik (Debtor)', value: 'debtor' },
        { label: 'Vjerovnik (Creditor)', value: 'creditor' },
        { label: 'Državno odvjetništvo (State attorney)', value: 'state_attorney' },
      ]},
      { key: 'filer_name', label: 'Ime podnositelja / Filer name', type: 'text', required: true },
      { key: 'filer_oib', label: 'OIB podnositelja', type: 'oib' },
      { key: 'debtor_name', label: 'Dužnik / Debtor', type: 'text', required: true },
      OIB,
      { key: 'debtor_address', label: 'Adresa dužnika', type: 'text', required: true },
      { key: 'court_name', label: 'Nadležni sud / Competent court', type: 'text', required: true, hint: 'e.g. Trgovački sud u Zagrebu' },
      { key: 'ground', label: 'Stečajni razlog / Ground', type: 'select', required: true, options: [
        { label: 'Platežna nesposobnost (Inability to pay)', value: 'inability_to_pay' },
        { label: 'Prezaduženost (Over-indebtedness)', value: 'over_indebtedness' },
      ]},
      { key: 'ground_details', label: 'Obrazloženje razloga / Ground details', type: 'textarea', required: true, rows: 5 },
      { key: 'creditors_summary', label: 'Sažetak vjerovnika / Creditors summary', type: 'textarea', rows: 5, hint: 'List known creditors and approximate amounts.' },
      { key: 'total_debt_eur', label: 'Ukupni dug (EUR, procjena)', type: 'currency' },
    ],
  },

  'restructuring-plan': {
    type: 'restructuring-plan',
    icon: '🔧',
    title: 'Plan restrukturiranja / Restructuring plan',
    description: 'Plan proposing debt restructuring instead of liquidation.',
    caseField: 'case_number',
    fields: [
      CASE,
      { key: 'debtor_name', label: 'Dužnik / Debtor', type: 'text', required: true },
      OIB,
      { key: 'proposer_name', label: 'Predlagatelj plana / Plan proposer', type: 'text', required: true },
      { key: 'proposed_haircut_pct', label: 'Predloženi otpis (%) / Proposed haircut', type: 'number', hint: '0–100' },
      { key: 'payment_term_months', label: 'Rok otplate (mjeseci) / Payment term (months)', type: 'number' },
      { key: 'creditor_classes_affected', label: 'Razredi vjerovnika obuhvaćeni planom', type: 'textarea', required: true, rows: 4 },
      { key: 'payment_schedule', label: 'Plan otplate / Payment schedule', type: 'textarea', required: true, rows: 5 },
      { key: 'operational_restructuring', label: 'Operativno restrukturiranje / Operational measures', type: 'textarea', rows: 5 },
      { key: 'viability_narrative', label: 'Obrazloženje održivosti / Viability narrative', type: 'textarea', rows: 5 },
    ],
  },

  'pre-bankruptcy-settlement': {
    type: 'pre-bankruptcy-settlement',
    icon: '🤝',
    title: 'Predstečajna nagodba / Pre-bankruptcy settlement',
    description: 'Settlement agreement filed before formal bankruptcy proceedings.',
    fields: [
      { key: 'debtor_name', label: 'Dužnik / Debtor', type: 'text', required: true },
      OIB,
      { key: 'filing_date', label: 'Datum podnošenja / Filing date', type: 'date', required: true },
      { key: 'total_debt_eur', label: 'Ukupni dug (EUR)', type: 'currency', required: true },
      { key: 'proposed_settlement_eur', label: 'Predloženi iznos nagodbe (EUR)', type: 'currency' },
      { key: 'creditor_consent_pct', label: 'Suglasnost vjerovnika (% by value)', type: 'number', hint: '0–100' },
      { key: 'settlement_terms', label: 'Uvjeti nagodbe / Settlement terms', type: 'textarea', required: true, rows: 6 },
      { key: 'payment_plan', label: 'Plan isplate / Payment plan', type: 'textarea', required: true, rows: 5 },
    ],
  },

  'asset-sale': {
    type: 'asset-sale',
    icon: '🔨',
    title: 'Prodaja imovine (aukcija / neposredna) / Asset sale (auction / direct)',
    description: 'Notice of asset sale from the bankruptcy estate.',
    caseField: 'case_number',
    fields: [
      CASE,
      { key: 'item_type', label: 'Vrsta imovine / Asset type', type: 'select', required: true, options: [
        { label: 'Nekretnina (Real estate)', value: 'real_estate' },
        { label: 'Pokretnina (Movable)', value: 'movable' },
        { label: 'Pravo (Right)', value: 'rights' },
      ]},
      { key: 'item_description', label: 'Opis imovine / Asset description', type: 'textarea', required: true, rows: 4 },
      { key: 'item_location', label: 'Lokacija / Location', type: 'text' },
      { key: 'sale_type', label: 'Način prodaje / Sale type', type: 'select', required: true, options: [
        { label: 'Javna dražba (Public auction)', value: 'auction' },
        { label: 'Neposredna prodaja (Direct sale)', value: 'direct_sale' },
      ]},
      { key: 'reserve_price_eur', label: 'Početna / početna cijena (EUR) / Reserve price', type: 'currency', required: true },
      { key: 'deposit_eur', label: 'Jamčevina (EUR) / Deposit', type: 'currency' },
      { key: 'sale_date', label: 'Datum prodaje / Sale date', type: 'date', required: true },
      { key: 'sale_location', label: 'Mjesto prodaje / Sale location', type: 'text' },
      { key: 'terms', label: 'Uvjeti / Terms & conditions', type: 'textarea', rows: 5 },
      { key: 'contact', label: 'Kontakt za pregled / Viewing contact', type: 'text' },
    ],
  },
}

export const FILING_TYPE_ORDER = [
  'motion-to-open',
  'prijava-trazbine',
  'asset-inventory',
  'asset-sale',
  'trustee-report',
  'distribution-proposal',
  'final-accounting',
  'restructuring-plan',
  'pre-bankruptcy-settlement',
] as const

export function getSchema(type: string): FilingSchema | null {
  return FILING_SCHEMAS[type] ?? null
}
