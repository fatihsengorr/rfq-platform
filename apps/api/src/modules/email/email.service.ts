import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { prisma } from "../../prisma.js";
import { emailConfig } from "./email.config.js";

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!emailConfig.enabled) return null;

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: emailConfig.host,
      port: emailConfig.port,
      secure: emailConfig.port === 465,
      auth:
        emailConfig.user && emailConfig.pass
          ? { user: emailConfig.user, pass: emailConfig.pass }
          : undefined,
    });
  }

  return transporter;
}

type NotificationParams = {
  type: string;
  recipientId: string;
  recipientEmail: string;
  rfqId?: string;
  subject: string;
  html: string;
};

/**
 * Creates a Notification audit record and sends an email (fire-and-forget).
 * If SMTP is not configured, only the audit record is created.
 */
export async function sendNotification(params: NotificationParams): Promise<void> {
  const notification = await prisma.notification.create({
    data: {
      type: params.type,
      recipientId: params.recipientId,
      rfqId: params.rfqId,
      subject: params.subject,
      body: params.html,
    },
  });

  const t = getTransporter();
  if (!t) return;

  // Fire-and-forget — don't block the API response
  t.sendMail({
    from: emailConfig.from,
    to: params.recipientEmail,
    subject: params.subject,
    html: params.html,
  })
    .then(() =>
      prisma.notification.update({
        where: { id: notification.id },
        data: { sentAt: new Date() },
      }),
    )
    .catch((err: unknown) =>
      prisma.notification.update({
        where: { id: notification.id },
        data: { failedAt: new Date(), errorMessage: String(err) },
      }),
    );
}
