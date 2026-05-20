/**
 * Editor-side endpoints for the bankruptcy filings workflow.
 *
 *   POST /api/editor/filing
 *     Body: { filingType, caseNumber?, data?, attachmentBase64?, attachmentFilename? }
 *     Auth: editor or admin (JWT).
 *     Creates a `bankruptcy-filings` doc with status=pending_review and
 *     submittedBy = req.user.email. Admins later approve/reject via the
 *     /admin/filings page (Payload-generated PATCH /api/bankruptcy-filings/:id).
 *     → { filingId }
 *
 *   POST /api/editor/extract
 *     multipart/form-data: file=<PDF | DOCX>
 *     Auth: editor or admin (JWT).
 *     Extracts plain text (pdf-parse for PDF, mammoth for DOCX), then asks the
 *     existing Ollama/Gemma endpoint (LLM_ENDPOINT) to pull a generic set of
 *     bankruptcy fields out of the text. Used by FilingFormPage's "pre-fill
 *     from upload" and the legacy EditorIngestPage.
 *     → { pdfBase64, fields, extractedText, mime }
 */
import { Router, type Request, type Response as ExpressResponse } from 'express'
import type { Payload } from 'payload'
import * as crypto from 'node:crypto'
import multer from 'multer'
import mammoth from 'mammoth'
// pdf-parse's package entry (index.js) executes a debug self-test that reads a
// missing PDF on import, throwing under ESM. Use the inner module path.
import pdfParse from 'pdf-parse/lib/pdf-parse.js'

interface AuthRequest extends Request {
  user?: { id: number | string; role?: string; email?: string }
}

const ALLOWED_FILING_TYPES = new Set([
  'motion-to-open',
  'prijava-trazbine',
  'asset-inventory',
  'asset-sale',
  'trustee-report',
  'distribution-proposal',
  'final-accounting',
  'restructuring-plan',
  'pre-bankruptcy-settlement',
])

function signingKey(): string {
  const raw = process.env.PAYLOAD_SECRET ?? ''
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 32)
}

async function verifyPayloadJwt(token: string): Promise<{ id: number | string; collection: string } | null> {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [h, b, s] = parts
  const expected = crypto.createHmac('sha256', signingKey()).update(`${h}.${b}`).digest('base64url')
  if (expected !== s) return null
  try {
    const decoded = JSON.parse(Buffer.from(b, 'base64url').toString('utf-8')) as {
      id: number | string; collection: string; exp?: number
    }
    if (decoded.exp && decoded.exp * 1000 < Date.now()) return null
    return decoded
  } catch {
    return null
  }
}

const OLLAMA_BASE = (process.env.LLM_ENDPOINT || 'http://172.18.0.1:11434/v1/chat/completions')
  .replace(/\/v1\/chat\/completions$/, '')
const CHAT_ENDPOINT = `${OLLAMA_BASE}/api/chat`
const EXTRACT_MODEL = process.env.LLM_EXTRACT_MODEL || process.env.LLM_MODEL || 'gemma-4-26b-a4b'
const LLM_API_TOKEN = process.env.LLM_API_TOKEN || ''
const EXTRACT_NUM_CTX = Number(process.env.EXTRACT_NUM_CTX || '8192')
const EXTRACT_TIMEOUT_MS = Number(process.env.EXTRACT_TIMEOUT_MS || '45000')
const EXTRACT_MAX_FILE_BYTES = Number(process.env.EXTRACT_MAX_FILE_BYTES || String(15 * 1024 * 1024))
// How much of the extracted text to send to the LLM. Long submissions are
// truncated — fields almost always live in the first ~6k chars of a filing.
const EXTRACT_TEXT_BUDGET = Number(process.env.EXTRACT_TEXT_BUDGET || '12000')

const EXTRACT_FIELDS_DOC = [
  'case_number       Croatian case number e.g. St-1234/2025',
  'debtor_name       Bankruptcy debtor (company or person)',
  'debtor_oib        11-digit Croatian OIB of the debtor',
  'creditor_name     Filing creditor (company or person), if applicable',
  'creditor_oib      11-digit Croatian OIB of the creditor, if applicable',
  'trustee_name      Stečajni upravitelj (bankruptcy trustee), if mentioned',
  'court_name        Court name e.g. Trgovački sud u Zagrebu',
  'claim_amount      Claim amount in EUR (number only)',
  'claim_basis       Pravni temelj tražbine (1-2 sentences)',
  'deadline          ISO date (YYYY-MM-DD) of any filing deadline',
  'published_at      ISO date (YYYY-MM-DD) of publication',
].join('\n')

function buildExtractPrompt(text: string): { system: string; user: string } {
  const system = [
    'You are a parser for Croatian bankruptcy (stečaj) filings.',
    'Read the document text and return ONLY a JSON object with the fields below.',
    'Use null for any field you cannot determine. Do not invent values.',
    'Strip currency symbols and thousands separators from numeric fields.',
    'Dates must be ISO YYYY-MM-DD or null.',
    '',
    'Fields:',
    EXTRACT_FIELDS_DOC,
  ].join('\n')
  const user = [
    'DOCUMENT TEXT:',
    '---',
    text.slice(0, EXTRACT_TEXT_BUDGET),
    '---',
    'Return JSON now.',
  ].join('\n')
  return { system, user }
}

async function llmExtractFields(text: string): Promise<Record<string, unknown>> {
  const { system, user } = buildExtractPrompt(text)
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (LLM_API_TOKEN) headers['Authorization'] = 'Bearer ' + LLM_API_TOKEN

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), EXTRACT_TIMEOUT_MS)
  let resp: globalThis.Response
  try {
    resp = await fetch(CHAT_ENDPOINT, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model: EXTRACT_MODEL,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        stream: false,
        format: 'json',
        options: { num_ctx: EXTRACT_NUM_CTX, temperature: 0 },
      }),
    })
  } finally {
    clearTimeout(timer)
  }

  if (!resp.ok) throw new Error(`LLM HTTP ${resp.status}`)
  const out = (await resp.json()) as { message?: { content?: string } }
  const raw = out.message?.content?.trim() ?? ''
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed as Record<string, unknown> : {}
  } catch {
    // If the model wrapped JSON in prose, try to recover the first {...} block.
    const m = raw.match(/\{[\s\S]*\}/)
    if (m) {
      try { return JSON.parse(m[0]) as Record<string, unknown> } catch { /* fall through */ }
    }
    return {}
  }
}

async function extractTextFromUpload(file: Express.Multer.File): Promise<{ text: string; mime: string }> {
  const name = (file.originalname || '').toLowerCase()
  const mime = (file.mimetype || '').toLowerCase()
  if (mime === 'application/pdf' || name.endsWith('.pdf')) {
    const out = await pdfParse(file.buffer)
    return { text: out.text ?? '', mime: 'application/pdf' }
  }
  if (
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    name.endsWith('.docx')
  ) {
    const out = await mammoth.extractRawText({ buffer: file.buffer })
    return { text: out.value ?? '', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }
  }
  throw new Error('Unsupported file type — upload a PDF or DOCX.')
}

export function createEditorRouter(payload: Payload): Router {
  const router = Router()

  // Attach req.user from `Authorization: JWT <token>`.
  router.use(async (req: AuthRequest, _res, next) => {
    try {
      const auth = req.headers.authorization
      if (auth?.startsWith('JWT ')) {
        const decoded = await verifyPayloadJwt(auth.slice(4))
        if (decoded?.collection === 'users' && decoded.id) {
          const doc = await payload.findByID({
            collection: 'users', id: decoded.id, overrideAccess: true, depth: 0,
          })
          if (doc) req.user = {
            id: doc.id as number | string,
            role: (doc as { role?: string }).role,
            email: (doc as { email?: string }).email,
          }
        }
      }
    } catch { /* unauthenticated — fall through */ }
    next()
  })

  function requireEditor(req: AuthRequest, res: ExpressResponse): boolean {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required.' })
      return false
    }
    const role = req.user.role
    if (role !== 'admin' && role !== 'editor') {
      res.status(403).json({ error: 'Editor role required.' })
      return false
    }
    return true
  }

  // ── POST /api/editor/filing ─────────────────────────────────────────────
  router.post('/editor/filing', async (req: AuthRequest, res) => {
    if (!requireEditor(req, res)) return

    const body = (req.body ?? {}) as {
      filingType?: string
      caseNumber?: string | null
      data?: Record<string, unknown> | null
      attachmentBase64?: string | null
      attachmentFilename?: string | null
    }

    if (!body.filingType || !ALLOWED_FILING_TYPES.has(body.filingType)) {
      return res.status(400).json({ error: 'Invalid or missing filingType.' })
    }

    try {
      const created = await payload.create({
        collection: 'bankruptcy-filings',
        data: {
          filingType: body.filingType,
          caseNumber: body.caseNumber ?? null,
          status: 'pending_review',
          submittedBy: req.user!.email ?? null,
          data: body.data ?? {},
          attachmentBase64: body.attachmentBase64 ?? null,
          attachmentFilename: body.attachmentFilename ?? null,
        } as Record<string, unknown>,
        overrideAccess: true,
      })
      return res.json({ filingId: created.id })
    } catch (e) {
      payload.logger.error({ err: e }, 'editor/filing create failed')
      return res.status(500).json({ error: 'Failed to create filing.', detail: String(e).slice(0, 200) })
    }
  })

  // ── POST /api/editor/extract ────────────────────────────────────────────
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: EXTRACT_MAX_FILE_BYTES, files: 1 },
  })

  router.post('/editor/extract', upload.single('file'), async (req: AuthRequest, res) => {
    if (!requireEditor(req, res)) return
    const file = (req as AuthRequest & { file?: Express.Multer.File }).file
    if (!file) return res.status(400).json({ error: 'No file uploaded (field name must be "file").' })

    let extracted: { text: string; mime: string }
    try {
      extracted = await extractTextFromUpload(file)
    } catch (e) {
      return res.status(400).json({ error: String((e as Error).message ?? e) })
    }

    let fields: Record<string, unknown> = {}
    let llmError: string | undefined
    if (extracted.text.trim().length > 0) {
      try {
        fields = await llmExtractFields(extracted.text)
      } catch (e) {
        llmError = String((e as Error).message ?? e).slice(0, 200)
        payload.logger.warn({ err: e }, 'editor/extract LLM call failed')
      }
    }

    return res.json({
      pdfBase64: file.buffer.toString('base64'),
      fields,
      extractedText: extracted.text,
      mime: extracted.mime,
      filename: file.originalname,
      ...(llmError ? { llmError } : {}),
    })
  })

  return router
}
