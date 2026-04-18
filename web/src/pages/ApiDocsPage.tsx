import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { ChevronDown, ChevronRight, Copy, Check, Key, Zap, Globe, Lock } from 'lucide-react'

// ── Design tokens ─────────────────────────────────────────────────────────────
const BASE_URL = 'https://api.sudacka-mreza.hr'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Param {
  name: string
  in: 'query' | 'path' | 'header'
  required: boolean
  type: string
  description: string
  example?: string
}

interface EndpointDef {
  method: 'GET'
  path: string
  summary: string
  description: string
  params: Param[]
  exampleRequest: string
  exampleResponse: string
}

// ── Endpoint definitions ──────────────────────────────────────────────────────

const ENDPOINTS: EndpointDef[] = [
  {
    method: 'GET',
    path: '/api/v1/decisions',
    summary: 'Popis sudskih odluka',
    description:
      'Vraća paginiran popis sudskih odluka. Može se filtrirati prema sudu, kategoriji i datumskom rasponu.',
    params: [
      { name: 'page', in: 'query', required: false, type: 'integer', description: 'Broj stranice (zadano: 1)', example: '1' },
      { name: 'limit', in: 'query', required: false, type: 'integer', description: 'Rezultata po stranici, maks. 100 (zadano: 20)', example: '20' },
      { name: 'court', in: 'query', required: false, type: 'string (UUID)', description: 'UUID suda za filtriranje', example: '9b1c3a4e-…' },
      { name: 'category', in: 'query', required: false, type: 'string', description: 'kazneno | gradjansko | upravno | prekrsajno | trgovacko', example: 'gradjansko' },
      { name: 'from', in: 'query', required: false, type: 'ISO date', description: 'Donji datum (uključivo)', example: '2023-01-01' },
      { name: 'to', in: 'query', required: false, type: 'ISO date', description: 'Gornji datum (uključivo)', example: '2023-12-31' },
      { name: 'apiKey', in: 'query', required: false, type: 'string', description: 'API ključ za veće ograničenje (alternativa zaglavlju)', example: 'sm_abc…' },
    ],
    exampleRequest: `curl "${BASE_URL}/api/v1/decisions?category=gradjansko&from=2023-01-01&limit=5" \\
  -H "X-API-Key: sm_your_key_here"`,
    exampleResponse: JSON.stringify({
      docs: [
        {
          id: '9b1c3a4e-1234-5678-abcd-ef0123456789',
          title: 'Presuda Gž 1234/2023',
          caseNumber: 'Gž 1234/2023',
          date: '2023-06-15',
          decisionType: 'presuda',
          category: 'gradjansko',
          slug: 'presuda-gz-1234-2023',
          court: { id: '…', name: 'Županijski sud u Zagrebu', type: 'county' },
        },
      ],
      totalDocs: 1842,
      page: 1,
      limit: 5,
      totalPages: 369,
      hasNextPage: true,
      hasPrevPage: false,
    }, null, 2),
  },
  {
    method: 'GET',
    path: '/api/v1/decisions/:id',
    summary: 'Pojedinost sudske odluke',
    description:
      'Vraća jednu sudsku odluku s punim tekstom. Parametar :id može biti UUID ili slug.',
    params: [
      { name: 'id', in: 'path', required: true, type: 'string', description: 'UUID ili slug odluke', example: 'presuda-gz-1234-2023' },
    ],
    exampleRequest: `curl "${BASE_URL}/api/v1/decisions/presuda-gz-1234-2023" \\
  -H "X-API-Key: sm_your_key_here"`,
    exampleResponse: JSON.stringify({
      id: '9b1c3a4e-1234-5678-abcd-ef0123456789',
      title: 'Presuda Gž 1234/2023',
      caseNumber: 'Gž 1234/2023',
      date: '2023-06-15',
      decisionType: 'presuda',
      category: 'gradjansko',
      slug: 'presuda-gz-1234-2023',
      textContent: 'Puni tekst odluke u plain-text formatu za indeksiranje…',
      richText: { root: { children: [] } },
      summary: 'Kratki sažetak odluke.',
      court: { id: '…', name: 'Županijski sud u Zagrebu', type: 'county', city: 'Zagreb' },
    }, null, 2),
  },
  {
    method: 'GET',
    path: '/api/v1/experts',
    summary: 'Imenik sudskih vještaka',
    description:
      'Vraća paginiran popis sudskih vještaka. Kontaktni podaci (telefon, email) su isključeni iz javnog API-ja.',
    params: [
      { name: 'page', in: 'query', required: false, type: 'integer', description: 'Broj stranice (zadano: 1)', example: '1' },
      { name: 'limit', in: 'query', required: false, type: 'integer', description: 'Rezultata po stranici, maks. 100 (zadano: 20)', example: '20' },
      { name: 'county', in: 'query', required: false, type: 'string', description: 'Filtriranje po županiji', example: 'Grad Zagreb' },
      { name: 'verified', in: 'query', required: false, type: 'boolean', description: 'true | false — samo verificirani / neverificirani', example: 'true' },
    ],
    exampleRequest: `curl "${BASE_URL}/api/v1/experts?county=Grad+Zagreb&verified=true" \\
  -H "X-API-Key: sm_your_key_here"`,
    exampleResponse: JSON.stringify({
      docs: [
        {
          id: 'aabb1122-…',
          name: 'Ante Anić',
          county: 'Grad Zagreb',
          city: 'Zagreb',
          verified: true,
          verifiedAt: '2023-03-01T00:00:00.000Z',
          lang: 'hr',
          slug: 'ante-anic',
        },
      ],
      totalDocs: 348,
      page: 1,
      limit: 20,
      totalPages: 18,
      hasNextPage: true,
      hasPrevPage: false,
    }, null, 2),
  },
  {
    method: 'GET',
    path: '/api/v1/interpreters',
    summary: 'Imenik sudskih tumača',
    description:
      'Vraća paginiran popis sudskih tumača/prevoditelja. Kontaktni podaci su isključeni iz javnog API-ja.',
    params: [
      { name: 'page', in: 'query', required: false, type: 'integer', description: 'Broj stranice (zadano: 1)', example: '1' },
      { name: 'limit', in: 'query', required: false, type: 'integer', description: 'Rezultata po stranici, maks. 100 (zadano: 20)', example: '20' },
      { name: 'county', in: 'query', required: false, type: 'string', description: 'Filtriranje po županiji', example: 'Splitsko-dalmatinska' },
      { name: 'verified', in: 'query', required: false, type: 'boolean', description: 'true | false — samo verificirani / neverificirani', example: 'true' },
    ],
    exampleRequest: `curl "${BASE_URL}/api/v1/interpreters?verified=true&limit=10"`,
    exampleResponse: JSON.stringify({
      docs: [
        {
          id: 'ccdd3344-…',
          name: 'Marija Marić',
          county: 'Splitsko-dalmatinska',
          city: 'Split',
          verified: true,
          verifiedAt: '2022-11-20T00:00:00.000Z',
          lang: 'hr',
          slug: 'marija-maric',
        },
      ],
      totalDocs: 201,
      page: 1,
      limit: 10,
      totalPages: 21,
      hasNextPage: true,
      hasPrevPage: false,
    }, null, 2),
  },
  {
    method: 'GET',
    path: '/api/v1/courts',
    summary: 'Imenik sudova',
    description:
      'Vraća paginiran popis sudova s kontaktnim podacima i koordinatama. Može se filtrirati prema vrsti suda ili županiji.',
    params: [
      { name: 'page', in: 'query', required: false, type: 'integer', description: 'Broj stranice (zadano: 1)', example: '1' },
      { name: 'limit', in: 'query', required: false, type: 'integer', description: 'Rezultata po stranici, maks. 200 (zadano: 50)', example: '50' },
      {
        name: 'type',
        in: 'query',
        required: false,
        type: 'string',
        description: 'municipal | county | commercial | misdemeanour | high_commercial | supreme | administrative | constitutional',
        example: 'county',
      },
      { name: 'county', in: 'query', required: false, type: 'string', description: 'Filtriranje po županiji', example: 'Grad Zagreb' },
    ],
    exampleRequest: `curl "${BASE_URL}/api/v1/courts?type=supreme"`,
    exampleResponse: JSON.stringify({
      docs: [
        {
          id: 'eeff5566-…',
          name: 'Vrhovni sud Republike Hrvatske',
          type: 'supreme',
          city: 'Zagreb',
          county: 'Grad Zagreb',
          address: 'Trg Nikole Šubića Zrinskog 3',
          phone: '+385 1 4801 000',
          fax: null,
          email: 'vrhovni@vsrh.hr',
          website: 'https://www.vsrh.hr',
          president: 'Radovan Dobronić',
          coordinates: { lat: 45.8131, lng: 15.9772 },
          slug: 'vrhovni-sud-rh',
        },
      ],
      totalDocs: 1,
      page: 1,
      limit: 50,
      totalPages: 1,
      hasNextPage: false,
      hasPrevPage: false,
    }, null, 2),
  },
  {
    method: 'GET',
    path: '/api/v1/statistics',
    summary: 'Agregatna statistika',
    description:
      'Vraća agregatne brojeve za sve glavne kolekcije. Odgovor se kešira 1 sat na strani servera.',
    params: [],
    exampleRequest: `curl "${BASE_URL}/api/v1/statistics"`,
    exampleResponse: JSON.stringify({
      totals: {
        decisions: 48291,
        courts: 127,
        experts: 2840,
        interpreters: 614,
      },
    }, null, 2),
  },
]

// ── Sub-components ────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <button
      onClick={handleCopy}
      aria-label="Kopiraj u međuspremnik"
      className="flex items-center gap-1 text-xs text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)] transition-colors px-2 py-1 rounded hover:bg-[color:var(--color-surface-subtle)]"
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
      {copied ? 'Kopirano' : 'Kopiraj'}
    </button>
  )
}

function MethodBadge({ method }: { method: string }) {
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
      {method}
    </span>
  )
}

function ParamBadge({ required }: { required: boolean }) {
  return required ? (
    <span className="text-xs font-medium text-red-600 dark:text-red-400">required</span>
  ) : (
    <span className="text-xs text-[color:var(--color-text-muted)]">optional</span>
  )
}

function CodeBlock({ code, lang = 'bash' }: { code: string; lang?: string }) {
  return (
    <div className="relative rounded-lg bg-[#0d1117] border border-[color:var(--color-border)] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10">
        <span className="text-xs text-white/40 font-mono">{lang}</span>
        <CopyButton text={code} />
      </div>
      <pre className="p-4 text-sm font-mono text-[#e6edf3] overflow-x-auto leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  )
}

function EndpointCard({ endpoint }: { endpoint: EndpointDef }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] overflow-hidden">
      {/* Header row */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-[color:var(--color-surface-subtle)] transition-colors"
        aria-expanded={open}
      >
        <MethodBadge method={endpoint.method} />
        <code className="text-sm font-mono text-[color:var(--color-heading)] flex-1">
          {endpoint.path}
        </code>
        <span className="text-sm text-[color:var(--color-text-muted)] hidden sm:block mr-4">
          {endpoint.summary}
        </span>
        {open ? (
          <ChevronDown size={16} className="text-[color:var(--color-text-muted)] shrink-0" />
        ) : (
          <ChevronRight size={16} className="text-[color:var(--color-text-muted)] shrink-0" />
        )}
      </button>

      {/* Body */}
      {open && (
        <div className="border-t border-[color:var(--color-border)] px-5 py-5 space-y-6">
          {/* Description */}
          <p className="text-sm text-[color:var(--color-text)]">{endpoint.description}</p>

          {/* Parameters */}
          {endpoint.params.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)] mb-3">
                Parametri
              </h4>
              <div className="overflow-x-auto rounded-lg border border-[color:var(--color-border)]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[color:var(--color-surface-subtle)] border-b border-[color:var(--color-border)]">
                      <th className="text-left px-4 py-2.5 font-semibold text-[color:var(--color-text-muted)] whitespace-nowrap">Naziv</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-[color:var(--color-text-muted)] whitespace-nowrap">U</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-[color:var(--color-text-muted)] whitespace-nowrap">Tip</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-[color:var(--color-text-muted)]">Opis</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-[color:var(--color-text-muted)] whitespace-nowrap">Obavezno</th>
                    </tr>
                  </thead>
                  <tbody>
                    {endpoint.params.map((p) => (
                      <tr key={p.name} className="border-b border-[color:var(--color-border)] last:border-0">
                        <td className="px-4 py-3">
                          <code className="text-xs font-mono bg-[color:var(--color-surface-subtle)] px-1.5 py-0.5 rounded text-[color:var(--color-heading)]">
                            {p.name}
                          </code>
                        </td>
                        <td className="px-4 py-3 text-xs text-[color:var(--color-text-muted)] font-mono">{p.in}</td>
                        <td className="px-4 py-3 text-xs text-[color:var(--color-text-muted)] font-mono whitespace-nowrap">{p.type}</td>
                        <td className="px-4 py-3 text-xs text-[color:var(--color-text)]">{p.description}</td>
                        <td className="px-4 py-3"><ParamBadge required={p.required} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Example request */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)] mb-3">
              Primjer zahtjeva
            </h4>
            <CodeBlock code={endpoint.exampleRequest} lang="bash" />
          </div>

          {/* Example response */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)] mb-3">
              Primjer odgovora
            </h4>
            <CodeBlock code={endpoint.exampleResponse} lang="json" />
          </div>
        </div>
      )}
    </div>
  )
}

// ── API Key Request Form ──────────────────────────────────────────────────────

type FormState = 'idle' | 'submitting' | 'success' | 'error'

function ApiKeyRequestForm() {
  const [name, setName] = useState('')
  const [org, setOrg] = useState('')
  const [email, setEmail] = useState('')
  const [state, setState] = useState<FormState>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setState('submitting')
    setErrorMsg('')

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          subject: 'Suradnja',
          message: `API ključ zahtjev\n\nOrganizacija: ${org || '(nije navedena)'}\nKontakt: ${name} <${email}>\n\nMolim pristup javnom REST API-ju Sudačke Mreže.`,
        }),
      })
      if (!res.ok) throw new Error('HTTP ' + res.status)
      setState('success')
      setName(''); setOrg(''); setEmail('')
    } catch {
      setState('error')
      setErrorMsg('Slanje nije uspjelo. Pokušajte ponovo ili nas kontaktirajte direktno.')
    }
  }

  if (state === 'success') {
    return (
      <div
        role="status"
        className="rounded-xl border border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-700 px-6 py-5 text-sm text-emerald-800 dark:text-emerald-300"
      >
        <p className="font-semibold mb-1">Zahtjev primljen</p>
        <p>Javit ćemo vam se na navedeni email u roku 2 radna dana.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="api-name" className="block text-sm font-medium text-[color:var(--color-text)] mb-1.5">
            Ime i prezime <span className="text-red-500" aria-hidden="true">*</span>
          </label>
          <input
            id="api-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ana Horvat"
            className="w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2.5 text-sm text-[color:var(--color-text)] placeholder-[color:var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-brand-navy)] transition"
          />
        </div>
        <div>
          <label htmlFor="api-org" className="block text-sm font-medium text-[color:var(--color-text)] mb-1.5">
            Organizacija / institucija
          </label>
          <input
            id="api-org"
            type="text"
            value={org}
            onChange={(e) => setOrg(e.target.value)}
            placeholder="Vrhovni sud Srbije"
            className="w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2.5 text-sm text-[color:var(--color-text)] placeholder-[color:var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-brand-navy)] transition"
          />
        </div>
      </div>

      <div>
        <label htmlFor="api-email" className="block text-sm font-medium text-[color:var(--color-text)] mb-1.5">
          Email adresa <span className="text-red-500" aria-hidden="true">*</span>
        </label>
        <input
          id="api-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="ana.horvat@sud.hr"
          className="w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2.5 text-sm text-[color:var(--color-text)] placeholder-[color:var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-brand-navy)] transition"
        />
      </div>

      {state === 'error' && (
        <div role="alert" className="text-sm text-red-600 dark:text-red-400">
          {errorMsg}
        </div>
      )}

      <button
        type="submit"
        disabled={state === 'submitting' || !name.trim() || !email.trim()}
        className="flex items-center gap-2 bg-[color:var(--color-brand-navy)] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
      >
        <Key size={15} />
        {state === 'submitting' ? 'Šaljem…' : 'Pošalji zahtjev'}
      </button>
    </form>
  )
}

// ── Info cards ────────────────────────────────────────────────────────────────

function InfoCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 space-y-2">
      <div className="flex items-center gap-2 text-[color:var(--color-heading)]">
        {icon}
        <h3 className="font-semibold text-sm">{title}</h3>
      </div>
      <div className="text-sm text-[color:var(--color-text)] space-y-1">{children}</div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ApiDocsPage() {
  return (
    <>
      <Helmet>
        <title>API Dokumentacija — Sudačka Mreža</title>
        <meta
          name="description"
          content="Javni REST API za pristup bazama sudskih odluka, vještaka, tumača i sudova Sudačke Mreže."
        />
      </Helmet>

      <div className="max-w-5xl mx-auto px-4 py-10 space-y-12">

        {/* ── Page header ─────────────────────────────────────────── */}
        <div className="border-b border-[color:var(--color-border)] pb-6">
          <h1 className="text-3xl font-bold text-[color:var(--color-heading)] mb-2">
            Javni REST API
          </h1>
          <p className="text-[color:var(--color-text-muted)] max-w-2xl">
            Otvoreni API za partnerske institucije i istraživače koji žele programatski pristup
            bazama podataka sudske prakse, vještaka, tumača i sudova Republike Hrvatske.
          </p>
        </div>

        {/* ── Getting started cards ────────────────────────────────── */}
        <section aria-labelledby="getting-started-heading">
          <h2 id="getting-started-heading" className="text-lg font-semibold text-[color:var(--color-heading)] mb-4">
            Početak rada
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <InfoCard icon={<Globe size={16} />} title="Osnovna URL adresa">
              <code className="text-xs font-mono break-all">{BASE_URL}/api/v1</code>
              <p className="text-xs text-[color:var(--color-text-muted)]">Svi odgovori su JSON, UTF-8</p>
            </InfoCard>

            <InfoCard icon={<Lock size={16} />} title="Autentikacija">
              <p>API ključ je opcionalan, ali povećava ograničenje.</p>
              <code className="text-xs font-mono block mt-1">X-API-Key: sm_…</code>
              <p className="text-xs text-[color:var(--color-text-muted)] mt-1">ili query param <code className="font-mono">?apiKey=</code></p>
            </InfoCard>

            <InfoCard icon={<Zap size={16} />} title="Ograničenja (rate limit)">
              <p><strong>Bez ključa:</strong> 100 zahtjeva / min per IP</p>
              <p><strong>S ključem:</strong> do 1 000 zahtjeva / min</p>
              <p className="text-xs text-[color:var(--color-text-muted)] mt-1">HTTP 429 pri prekoračenju</p>
            </InfoCard>
          </div>
        </section>

        {/* ── Pagination note ──────────────────────────────────────── */}
        <section aria-labelledby="pagination-heading">
          <h2 id="pagination-heading" className="text-lg font-semibold text-[color:var(--color-heading)] mb-3">
            Paginacija
          </h2>
          <p className="text-sm text-[color:var(--color-text)] mb-3">
            Svi endpoint-i liste vraćaju isti format paginiranog odgovora:
          </p>
          <CodeBlock
            lang="json"
            code={JSON.stringify({
              docs: ['… array of results …'],
              totalDocs: 12500,
              page: 1,
              limit: 20,
              totalPages: 625,
              hasNextPage: true,
              hasPrevPage: false,
            }, null, 2)}
          />
        </section>

        {/* ── Endpoints ────────────────────────────────────────────── */}
        <section aria-labelledby="endpoints-heading">
          <h2 id="endpoints-heading" className="text-lg font-semibold text-[color:var(--color-heading)] mb-4">
            Endpoint-i
          </h2>
          <p className="text-sm text-[color:var(--color-text-muted)] mb-4">
            Kliknite na endpoint za parametre, primjer zahtjeva i odgovora.
          </p>
          <div className="space-y-3">
            {ENDPOINTS.map((ep) => (
              <EndpointCard key={ep.path} endpoint={ep} />
            ))}
          </div>
        </section>

        {/* ── CORS note ─────────────────────────────────────────────── */}
        <section aria-labelledby="cors-heading" className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
          <h2 id="cors-heading" className="font-semibold text-[color:var(--color-heading)] mb-2">
            CORS
          </h2>
          <p className="text-sm text-[color:var(--color-text)]">
            Svi <code className="font-mono text-xs">/api/v1/*</code> endpoint-i vraćaju{' '}
            <code className="font-mono text-xs">Access-Control-Allow-Origin: *</code> — API
            je dostupan direktno iz preglednika s bilo koje domene.
          </p>
        </section>

        {/* ── API Key Request Form ─────────────────────────────────── */}
        <section aria-labelledby="request-key-heading" className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 space-y-5">
          <div>
            <h2 id="request-key-heading" className="text-lg font-semibold text-[color:var(--color-heading)] mb-1 flex items-center gap-2">
              <Key size={18} />
              Zatraži API ključ
            </h2>
            <p className="text-sm text-[color:var(--color-text-muted)]">
              API ključ nije obavezan za testiranje, ali se preporuča za produkcijsku upotrebu
              jer daje veće ograničenje (1 000 zahtjeva/min). Ispunite obrazac i odgovorit ćemo
              u roku 2 radna dana.
            </p>
          </div>
          <ApiKeyRequestForm />
        </section>

      </div>
    </>
  )
}
