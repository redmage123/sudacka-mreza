/**
 * eSPIS Integration — Croatia's official court information system (eSpis)
 *
 * STATUS: STUB — API access not yet granted.
 *
 * The interface and mock implementation are production-ready.
 * When API credentials are obtained, uncomment the RealEspisClient
 * class below and swap it in at the bottom of this file.
 *
 * Config (set in .env):
 *   ESPIS_API_URL  — Base URL of the eSPIS REST API
 *   ESPIS_API_KEY  — API key / bearer token issued by MP (Ministarstvo pravosuđa)
 */

// ─── Domain types ──────────────────────────────────────────────────────────────

export interface Decision {
  /** eSPIS internal document ID */
  id: string
  /** Structured case number, e.g. "Gž-1234/2024" */
  caseNumber: string
  /** Full title of the decision */
  title: string
  /** ISO name of the court, e.g. "Županijski sud u Zagrebu" */
  court: string
  /** Category: civil | criminal | commercial | administrative | constitutional */
  decisionType: 'civil' | 'criminal' | 'commercial' | 'administrative' | 'constitutional'
  /** Date the decision was issued */
  date: Date
  /** Full plain-text body of the decision */
  fullText: string
  /** Short abstract, if provided by eSPIS */
  summary?: string
  /** Languages in which the document is available */
  languages: ('hr' | 'en')[]
}

export interface CaseStatus {
  caseNumber: string
  status: 'active' | 'closed' | 'appealed' | 'pending'
  court: string
  lastActivity: Date
  nextHearing?: Date
  parties: { role: 'plaintiff' | 'defendant' | 'other'; name: string }[]
}

export interface CaseResult {
  caseNumber: string
  title: string
  court: string
  date: Date
  decisionType: Decision['decisionType']
  relevanceScore: number
}

// ─── Client interface ───────────────────────────────────────────────────────────

export interface EspisClient {
  /**
   * Fetch decisions published by a specific court since the given date.
   * Intended for incremental sync (cron job).
   */
  fetchNewDecisions(court: string, since: Date): Promise<Decision[]>

  /**
   * Fetch the current procedural status of a case by case number.
   */
  fetchCaseStatus(caseNumber: string): Promise<CaseStatus>

  /**
   * Full-text search across all published decisions.
   */
  searchCases(query: string): Promise<CaseResult[]>
}

// ─── Mock implementation ────────────────────────────────────────────────────────

/**
 * MockEspisClient — returns realistic sample data.
 * Safe to use in development and CI with no external dependencies.
 */
export class MockEspisClient implements EspisClient {
  async fetchNewDecisions(court: string, since: Date): Promise<Decision[]> {
    console.log(`[eSPIS mock] fetchNewDecisions(court="${court}", since=${since.toISOString()})`)

    return [
      {
        id: 'espis-mock-001',
        caseNumber: 'Gž-1122/2024',
        title: 'Presuda o naknadi nematerijalne štete',
        court,
        decisionType: 'civil',
        date: new Date('2024-11-15'),
        fullText:
          'Sud je odlučio da tuženik naknadi tužitelju nematerijalnu štetu u iznosu od 15.000 EUR...',
        summary: 'Naknada nematerijalne štete zbog povrede osobnih prava.',
        languages: ['hr'],
      },
      {
        id: 'espis-mock-002',
        caseNumber: 'Kž-887/2024',
        title: 'Presuda u kaznenom predmetu',
        court,
        decisionType: 'criminal',
        date: new Date('2024-12-01'),
        fullText: 'Optuženik je proglašen krivim za kazneno djelo prijevare...',
        languages: ['hr'],
      },
    ]
  }

  async fetchCaseStatus(caseNumber: string): Promise<CaseStatus> {
    console.log(`[eSPIS mock] fetchCaseStatus(caseNumber="${caseNumber}")`)

    return {
      caseNumber,
      status: 'active',
      court: 'Županijski sud u Zagrebu',
      lastActivity: new Date('2024-12-10'),
      nextHearing: new Date('2025-02-14T10:00:00Z'),
      parties: [
        { role: 'plaintiff', name: 'Ana Horvat' },
        { role: 'defendant', name: 'XYZ d.o.o.' },
      ],
    }
  }

  async searchCases(query: string): Promise<CaseResult[]> {
    console.log(`[eSPIS mock] searchCases(query="${query}")`)

    return [
      {
        caseNumber: 'Gž-1122/2024',
        title: 'Presuda o naknadi nematerijalne štete',
        court: 'Županijski sud u Zagrebu',
        date: new Date('2024-11-15'),
        decisionType: 'civil',
        relevanceScore: 0.92,
      },
      {
        caseNumber: 'P-3345/2023',
        title: 'Rješenje o zastari tražbine',
        court: 'Općinski sud u Splitu',
        date: new Date('2023-09-22'),
        decisionType: 'civil',
        relevanceScore: 0.74,
      },
    ]
  }
}

// ─── Real implementation placeholder ───────────────────────────────────────────
//
// Uncomment and complete this class once API credentials are obtained from
// Ministarstvo pravosuđa i uprave (MPA). Replace the export at the bottom.
//
// import https from 'node:https'
//
// export class RealEspisClient implements EspisClient {
//   private readonly baseUrl: string
//   private readonly apiKey: string
//
//   constructor() {
//     if (!process.env.ESPIS_API_URL) throw new Error('ESPIS_API_URL is not set')
//     if (!process.env.ESPIS_API_KEY) throw new Error('ESPIS_API_KEY is not set')
//     this.baseUrl = process.env.ESPIS_API_URL.replace(/\/$/, '')
//     this.apiKey  = process.env.ESPIS_API_KEY
//   }
//
//   private async get<T>(path: string): Promise<T> {
//     const res = await fetch(`${this.baseUrl}${path}`, {
//       headers: { Authorization: `Bearer ${this.apiKey}`, Accept: 'application/json' },
//     })
//     if (!res.ok) throw new Error(`eSPIS API error ${res.status} on ${path}`)
//     return res.json() as Promise<T>
//   }
//
//   async fetchNewDecisions(court: string, since: Date): Promise<Decision[]> {
//     // Endpoint TBC — adjust path and field mapping once API docs are available
//     const data = await this.get<any[]>(
//       `/decisions?court=${encodeURIComponent(court)}&since=${since.toISOString()}`,
//     )
//     return data.map((d) => ({
//       id:           d.id,
//       caseNumber:   d.predmetBroj,
//       title:        d.naslov,
//       court:        d.sud,
//       decisionType: d.vrstaOdluke,
//       date:         new Date(d.datumOdluke),
//       fullText:     d.tekst,
//       summary:      d.sazetak,
//       languages:    d.jezici ?? ['hr'],
//     }))
//   }
//
//   async fetchCaseStatus(caseNumber: string): Promise<CaseStatus> {
//     const d = await this.get<any>(`/cases/${encodeURIComponent(caseNumber)}`)
//     return {
//       caseNumber:   d.predmetBroj,
//       status:       d.status,
//       court:        d.sud,
//       lastActivity: new Date(d.zadnjaAktivnost),
//       nextHearing:  d.sljedeceRociste ? new Date(d.sljedeceRociste) : undefined,
//       parties:      d.stranke ?? [],
//     }
//   }
//
//   async searchCases(query: string): Promise<CaseResult[]> {
//     const data = await this.get<any[]>(`/search?q=${encodeURIComponent(query)}`)
//     return data.map((d) => ({
//       caseNumber:    d.predmetBroj,
//       title:         d.naslov,
//       court:         d.sud,
//       date:          new Date(d.datum),
//       decisionType:  d.vrsta,
//       relevanceScore: d.score ?? 0,
//     }))
//   }
// }

// ─── Export active client ───────────────────────────────────────────────────────

/**
 * Shared eSPIS client instance.
 * Swap MockEspisClient → RealEspisClient once API access is granted.
 */
export const espisClient: EspisClient = new MockEspisClient()
