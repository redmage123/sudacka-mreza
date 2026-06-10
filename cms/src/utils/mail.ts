/**
 * Minimal email transport for the CMS.
 *
 * Delivery path in priority order:
 *   1. RESEND_API_KEY    — HTTP POST to api.resend.com
 *   2. msmtp binary      — shells out to /usr/bin/msmtp if installed in the
 *                          image (requires the host's /etc/msmtprc bind-mounted
 *                          read-only; see docker-compose cms.volumes).
 *   3. Console log       — final fallback so dev/staging never silently drops
 *                          mail. The payload is still written to the CMS log
 *                          at INFO so operators can retrieve it.
 *
 * This deliberately mirrors the bankruptcy-ingest container's approach for
 * consistency. No external dependencies; Node's built-ins only.
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import type { Payload } from 'payload'

export interface MailMessage {
  to: string
  subject: string
  text: string
  from?: string
  cc?: string | string[]
}

function normalizeCc(cc: string | string[] | undefined): string[] {
  if (!cc) return []
  return (Array.isArray(cc) ? cc : [cc]).map((s) => s.trim()).filter(Boolean)
}

// Includes a display name so the message shows as "Sudačka Mreža" rather than
// a bare address. NOTE: when sent through the Gmail SMTP relay (the msmtp
// transport), Gmail rewrites the address part to the authenticated account
// (semackenzie@gmail.com) because noreply@sudacka-mreza.hr isn't a verified
// "send mail as" alias — but it keeps this display name. A real sender domain
// still needs either that alias verified or a Resend-style service.
const DEFAULT_FROM = process.env.MAIL_FROM ?? 'Sudačka Mreža <noreply@sudacka-mreza.hr>'

export async function sendMail(payload: Payload, msg: MailMessage): Promise<'resend' | 'msmtp' | 'console'> {
  const from = msg.from ?? DEFAULT_FROM
  const cc = normalizeCc(msg.cc)

  // ── 1. Resend HTTP API ──────────────────────────────────────────────────
  const resendKey = process.env.RESEND_API_KEY
  if (resendKey && resendKey.length > 0) {
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resendKey}` },
        body: JSON.stringify({
          from,
          to: [msg.to],
          ...(cc.length ? { cc } : {}),
          subject: msg.subject,
          text: msg.text,
        }),
      })
      if (r.ok) return 'resend'
      payload.logger.warn({ status: r.status }, 'resend returned non-2xx; falling through')
    } catch (e) {
      payload.logger.warn({ err: e }, 'resend call failed; falling through')
    }
  }

  // ── 2. msmtp shell-out ──────────────────────────────────────────────────
  if (existsSync('/usr/bin/msmtp') && existsSync('/etc/msmtprc')) {
    try {
      const sent = await new Promise<boolean>((resolve) => {
        // `-t` reads recipients from the headers; `--aliases /dev/null`
        // bypasses the host's /etc/aliases which has a `default:` catch-all
        // that would otherwise rewrite every recipient to a single mailbox.
        const proc = spawn('/usr/bin/msmtp', ['-t', '--aliases', '/dev/null'],
                           { stdio: ['pipe', 'pipe', 'pipe'] })
        let stderr = ''
        proc.stderr.on('data', (b: Buffer) => { stderr += b.toString() })
        proc.on('close', (code) => {
          if (code !== 0) payload.logger.warn({ code, stderr }, 'msmtp exited non-zero')
          resolve(code === 0)
        })
        proc.on('error', (e) => {
          payload.logger.warn({ err: e }, 'msmtp spawn failed')
          resolve(false)
        })
        const headers = [
          `From: ${from}`,
          `To: ${msg.to}`,
          ...(cc.length ? [`Cc: ${cc.join(', ')}`] : []),
          `Subject: ${msg.subject}`,
          'MIME-Version: 1.0',
          'Content-Type: text/plain; charset=UTF-8',
          '',
        ].join('\r\n')
        proc.stdin.write(`${headers}\r\n${msg.text}\r\n`)
        proc.stdin.end()
      })
      if (sent) return 'msmtp'
    } catch (e) {
      payload.logger.warn({ err: e }, 'msmtp shell-out failed; falling through')
    }
  }

  // ── 3. Console fallback ─────────────────────────────────────────────────
  payload.logger.info(
    { from, to: msg.to, cc, subject: msg.subject, body: msg.text },
    'EMAIL (console fallback — no transport configured)',
  )
  return 'console'
}
