// Raw Brevo transactional email API — no SDK dependency, uses native fetch.

export interface BrevoAddress {
  email: string;
  name?: string;
}

export interface SendSmtpEmailPayload {
  sender: BrevoAddress;
  to: BrevoAddress[];
  subject: string;
  htmlContent: string;
  textContent: string;
  tags?: string[];
}

const BREVO_SMTP_URL = "https://api.brevo.com/v3/smtp/email";

export async function sendBrevoEmail(
  apiKey: string,
  payload: SendSmtpEmailPayload,
): Promise<void> {
  const res = await fetch(BREVO_SMTP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Brevo API error ${String(res.status)}: ${body}`);
  }
}
