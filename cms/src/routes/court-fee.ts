/**
 * GET /api/court-fee/calculate
 * GET /api/court-fee/types
 *
 * Court fee (sudska pristojba) calculator (FR-020).
 *
 * Implements the fee schedule from Zakon o sudskim pristojbama (NN 118/18)
 * as amended after Croatia's adoption of EUR on 01 January 2023.
 *
 * The fee is computed in two steps:
 *   1. Calculate the base fee (taksena osnova) from the claim value using a
 *      sliding scale defined in the law.
 *   2. Multiply by the proceeding-type-specific rate (Tarifni broj).
 *
 * NOTE: These rates are informational. The client must verify calculated
 * amounts against the official tariff and the current site's output before
 * production use (spec §6.1 acceptance criterion).
 *
 * Query params (calculate):
 *   claimValue     – numeric claim value in EUR (required)
 *   proceedingType – one of the keys from PROCEEDING_TYPES (required)
 */

import { Router, Request, Response } from 'express'

const router = Router()

// ---------------------------------------------------------------------------
// Fee base (taksena osnova) — sliding scale in EUR
// Source: Tarifni broj 1, Zakon o sudskim pristojbama NN 118/18
// Converted from HRK at the fixed EUR rate of 7.53450 HRK = 1 EUR.
// ---------------------------------------------------------------------------
function calculateBase(value: number): number {
  if (value <= 0) return 0
  if (value <= 497.92) return 6.64
  if (value <= 4979.20) return 6.64 + 0.01 * (value - 497.92)
  if (value <= 24896.02) return 51.46 + 0.005 * (value - 4979.20)
  // Statutory maximum ~663.61 EUR for general civil proceedings
  const raw = 151.05 + 0.0025 * (value - 24896.02)
  return Math.min(raw, 663.61)
}

// ---------------------------------------------------------------------------
// Proceeding types with multipliers and bilingual labels
// ---------------------------------------------------------------------------
interface ProceedingInfo {
  multiplier: number
  label_hr: string
  label_en: string
  tariffRef: string
}

const PROCEEDING_TYPES: Record<string, ProceedingInfo> = {
  civil_complaint: {
    multiplier: 1.0,
    label_hr: 'Tužba (parnica, prvostupanjski)',
    label_en: 'Civil complaint (first instance)',
    tariffRef: 'Tarifni br. 1',
  },
  civil_judgment: {
    multiplier: 2.0,
    label_hr: 'Presuda (parnica, prvostupanjski)',
    label_en: 'Civil judgment (first instance)',
    tariffRef: 'Tarifni br. 2',
  },
  civil_appeal: {
    multiplier: 1.5,
    label_hr: 'Žalba u parnici',
    label_en: 'Civil appeal',
    tariffRef: 'Tarifni br. 7',
  },
  civil_revision: {
    multiplier: 2.0,
    label_hr: 'Revizija (Vrhovni sud)',
    label_en: 'Revision / cassation (Supreme Court)',
    tariffRef: 'Tarifni br. 9',
  },
  enforcement_order: {
    multiplier: 0.5,
    label_hr: 'Prijedlog za ovrhu',
    label_en: 'Enforcement order',
    tariffRef: 'Tarifni br. 11',
  },
  enforcement_judgment: {
    multiplier: 1.0,
    label_hr: 'Rješenje o ovrsi',
    label_en: 'Enforcement judgment',
    tariffRef: 'Tarifni br. 12',
  },
  commercial_complaint: {
    multiplier: 1.5,
    label_hr: 'Tužba (Trgovački sud, prvostupanjski)',
    label_en: 'Commercial complaint (first instance)',
    tariffRef: 'Tarifni br. 1 (trgovački)',
  },
  commercial_judgment: {
    multiplier: 3.0,
    label_hr: 'Presuda (Visoki trgovački sud)',
    label_en: 'Commercial judgment (High Commercial Court)',
    tariffRef: 'Tarifni br. 2 (trgovački)',
  },
  bankruptcy_petition: {
    multiplier: 1.5,
    label_hr: 'Stečajni prijedlog',
    label_en: 'Bankruptcy petition',
    tariffRef: 'Tarifni br. 31',
  },
  land_registry: {
    multiplier: 0.5,
    label_hr: 'Zemljišnoknjižni zahtjev',
    label_en: 'Land registry request',
    tariffRef: 'Tarifni br. 24',
  },
  administrative: {
    multiplier: 1.0,
    label_hr: 'Tužba (Upravni sud)',
    label_en: 'Administrative court complaint',
    tariffRef: 'Tarifni br. 21',
  },
  constitutional: {
    multiplier: 1.0,
    label_hr: 'Ustavna tužba',
    label_en: 'Constitutional complaint',
    tariffRef: 'Tarifni br. 35',
  },
}

// ---------------------------------------------------------------------------
// GET /api/court-fee/types  — list all valid proceeding types for UI dropdowns
// ---------------------------------------------------------------------------
router.get('/court-fee/types', (_req: Request, res: Response) => {
  const types = Object.entries(PROCEEDING_TYPES).map(([value, info]) => ({
    value,
    label_hr: info.label_hr,
    label_en: info.label_en,
    tariffRef: info.tariffRef,
    multiplier: info.multiplier,
  }))
  return res.json(types)
})

// ---------------------------------------------------------------------------
// GET /api/court-fee/calculate
// ---------------------------------------------------------------------------
router.get('/court-fee/calculate', (req: Request, res: Response) => {
  const claimValueRaw = String(req.query.claimValue || '')
  const proceedingType = String(req.query.proceedingType || '')

  const claimValue = parseFloat(claimValueRaw)

  if (!claimValueRaw || isNaN(claimValue) || claimValue < 0) {
    return res.status(422).json({
      error: 'Nevažeći iznos tužbenog zahtjeva. Unesite pozitivan broj u EUR.',
    })
  }

  const proceeding = PROCEEDING_TYPES[proceedingType]
  if (!proceeding) {
    return res.status(422).json({
      error: 'Nepoznata vrsta postupka.',
      validTypes: Object.keys(PROCEEDING_TYPES),
    })
  }

  const base = Math.round(calculateBase(claimValue) * 100) / 100
  const fee = Math.round(base * proceeding.multiplier * 100) / 100

  return res.json({
    input: {
      claimValue,
      proceedingType,
      proceedingLabel: {
        hr: proceeding.label_hr,
        en: proceeding.label_en,
      },
    },
    breakdown: {
      base,
      multiplier: proceeding.multiplier,
      tariffRef: proceeding.tariffRef,
      fee,
    },
    total: fee,
    currency: 'EUR',
    disclaimer:
      'Iznos sudske pristojbe je informativni izračun prema Zakonu o sudskim pristojbama (NN 118/18). Za točan iznos obratite se nadležnom sudu.',
  })
})

export default router
