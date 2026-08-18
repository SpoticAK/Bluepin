import nodemailer from 'nodemailer';

let mailTransporter: nodemailer.Transporter | null = null;

export function getMailTransporter(): nodemailer.Transporter | null {
  if (!mailTransporter && process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    mailTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return mailTransporter;
}

export interface FeedbackEmailPayload {
  subject: string;
  message: string;
  userEmail?: string;
}

export async function sendFeedbackEmail({ subject, message, userEmail }: FeedbackEmailPayload) {
  const transporter = getMailTransporter();
  if (!transporter) {
    console.warn("SMTP credentials are not fully configured. Feedback would be:", { subject, message, userEmail });
    return { success: true, simulated: true };
  }

  const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || "hello@bluepin.in";

  await transporter.sendMail({
    from: `"Bluepin Feedback" <${fromEmail}>`,
    to: 'sparsh@bluepin.in',
    subject: subject,
    text: `From: ${userEmail || 'Anonymous'}\n\nMessage:\n${message}`,
    replyTo: userEmail || undefined
  });

  return { success: true, simulated: false };
}
