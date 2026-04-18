/**
 * GET /api/decisions/:id/pdf
 *
 * Generates a formatted PDF for a court decision and returns it as a
 * downloadable attachment. Uses Playwright's PDF rendering so the output
 * is styled with proper Croatian legal document conventions.
 *
 * PDF contains:
 *   - Court header (name + address)
 *   - Case number (prominent)
 *   - Decision date and type
 *   - Full decision text (from fullTextPlain)
 *   - Footer: "Izvor: Sudačka Mreža — sudacka-mreza.hr"
 */

import { Router, Request, Response } from 'express'
import { chromium } from 'playwright'

const DECISION_TYPE_LABELS: Record<string, string> = {
  civil: 'Građansko',
  criminal: 'Kazneno',
  commercial: 'Trgovačko',
  administrative: 'Upravno',
  constitutional: 'Ustavno',
  ecj: 'Europski sud pravde (ECJ)',
  ecthr: 'Europski sud za ljudska prava (ECtHR)',
}

function escapeHtml(text: string): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('hr-HR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function buildHtml(doc: any): string {
  const court = typeof doc.court === 'object' && doc.court !== null ? doc.court : null
  const courtName = court?.name ?? ''
  const courtAddress = [court?.address, court?.city].filter(Boolean).join(', ')
  const caseNumber = escapeHtml(doc.caseNumber ?? '')
  const decisionType = escapeHtml(DECISION_TYPE_LABELS[doc.decisionType] ?? doc.decisionType ?? '')
  const date = formatDate(doc.date)
  const title = escapeHtml(doc.title ?? '')
  const bodyText = doc.fullTextPlain ?? ''

  // Convert plain text to paragraphs: split on double newlines, fallback to single
  const paragraphs = bodyText
    .split(/\n{2,}/)
    .map((p: string) => p.trim())
    .filter((p: string) => p.length > 0)
    .map((p: string) =>
      `<p>${escapeHtml(p).replace(/\n/g, '<br/>')}</p>`,
    )
    .join('\n')

  return `<!DOCTYPE html>
<html lang="hr">
<head>
  <meta charset="UTF-8"/>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #111;
      padding: 0;
    }

    .page {
      padding: 20mm 22mm 25mm 22mm;
    }

    /* Court header */
    .court-header {
      text-align: center;
      border-bottom: 2px solid #111;
      padding-bottom: 10px;
      margin-bottom: 18px;
    }
    .court-name {
      font-size: 14pt;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .court-address {
      font-size: 9pt;
      color: #444;
      margin-top: 3px;
    }

    /* Case metadata */
    .case-meta {
      margin-bottom: 20px;
    }
    .case-number {
      font-size: 16pt;
      font-weight: bold;
      text-align: center;
      margin-bottom: 10px;
      letter-spacing: 0.3px;
    }
    .meta-table {
      width: 100%;
      border-collapse: collapse;
    }
    .meta-table td {
      padding: 4px 8px;
      font-size: 10pt;
    }
    .meta-table td:first-child {
      font-weight: bold;
      width: 130px;
      color: #333;
    }
    .meta-table tr:nth-child(odd) td {
      background: #f7f7f7;
    }

    /* Title */
    .decision-title {
      font-size: 12pt;
      font-weight: bold;
      text-align: center;
      margin: 18px 0 14px;
      line-height: 1.4;
    }

    /* Body text */
    .decision-body {
      margin-top: 12px;
    }
    .decision-body p {
      margin-bottom: 10px;
      text-align: justify;
      hyphens: auto;
    }

    /* Footer */
    .footer {
      position: fixed;
      bottom: 8mm;
      left: 22mm;
      right: 22mm;
      border-top: 1px solid #ccc;
      padding-top: 4px;
      font-size: 8pt;
      color: #666;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="footer">Izvor: Sudačka Mreža — sudacka-mreza.hr</div>

  <div class="page">
    <div class="court-header">
      <div class="court-name">${escapeHtml(courtName)}</div>
      ${courtAddress ? `<div class="court-address">${escapeHtml(courtAddress)}</div>` : ''}
    </div>

    <div class="case-meta">
      <div class="case-number">${caseNumber}</div>
      <table class="meta-table">
        <tr>
          <td>Datum odluke:</td>
          <td>${date}</td>
        </tr>
        <tr>
          <td>Vrsta postupka:</td>
          <td>${decisionType}</td>
        </tr>
      </table>
    </div>

    ${title ? `<div class="decision-title">${title}</div>` : ''}

    <div class="decision-body">
      ${paragraphs || '<p><em>Tekst odluke nije dostupan.</em></p>'}
    </div>
  </div>
</body>
</html>`
}

export function createPdfExportRouter(payload: any) {
  const router = Router()

  router.get('/decisions/:id/pdf', async (req: Request, res: Response) => {
    const { id } = req.params

    let doc: any
    try {
      doc = await payload.findByID({
        collection: 'court-decisions',
        id,
        depth: 1,
      })
    } catch {
      return res.status(404).json({ error: 'Odluka nije pronađena' })
    }

    if (!doc) {
      return res.status(404).json({ error: 'Odluka nije pronađena' })
    }

    let browser: any
    try {
      browser = await chromium.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] })
      const page = await browser.newPage()
      await page.setContent(buildHtml(doc), { waitUntil: 'domcontentloaded' })

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        displayHeaderFooter: false,
        margin: { top: '0', bottom: '0', left: '0', right: '0' },
      })

      const safeCase = String(doc.caseNumber ?? id).replace(/[^a-zA-Z0-9\-_]/g, '-')
      res.set('Content-Type', 'application/pdf')
      res.set('Content-Disposition', `attachment; filename="odluka-${safeCase}.pdf"`)
      res.set('Cache-Control', 'private, no-store')
      return res.send(Buffer.from(pdfBuffer))
    } catch (err) {
      payload.logger.error('PDF generation error:', err)
      return res.status(500).json({ error: 'Greška pri generiranju PDF-a' })
    } finally {
      if (browser) await browser.close()
    }
  })

  return router
}
