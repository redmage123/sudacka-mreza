import { Resend } from 'resend'

interface ContactEmailParams {
  name: string
  email: string
  subject: string
  message: string
}

export async function sendContactEmail(params: ContactEmailParams): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  const contactEmail = process.env.CONTACT_EMAIL || 'info@sudacka-mreza.hr'

  if (!apiKey) {
    console.warn('RESEND_API_KEY not set, skipping email send')
    return false
  }

  const resend = new Resend(apiKey)

  try {
    await resend.emails.send({
      from: 'Sudačka Mreža <noreply@sudacka-mreza.hr>',
      to: [contactEmail],
      subject: `Kontakt forma: ${params.subject}`,
      replyTo: params.email,
      text: [
        `Ime: ${params.name}`,
        `Email: ${params.email}`,
        `Predmet: ${params.subject}`,
        '',
        'Poruka:',
        params.message,
      ].join('\n'),
    })
    return true
  } catch (error) {
    console.error('Failed to send contact email:', error)
    return false
  }
}
