// Email templates — plain HTML, no external renderer dependency.
// Keep styles inline for maximum email client compatibility.

const base = (title: string, body: string): string => `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><title>${title}</title></head>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:0">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 0">
      <table width="600" cellpadding="0" cellspacing="0"
        style="background:#fff;border-radius:8px;padding:40px">
        <tr><td>
          <h1 style="color:#1a1a2e;font-size:24px;margin:0 0 24px">Praxisa</h1>
          ${body}
          <p style="color:#9ca3af;font-size:12px;margin:40px 0 0">
            Praxisa &mdash; plateforme de formation professionnelle
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

const text = (lines: string[]): string => lines.join("\n\n");

// ── Email verification ─────────────────────────────────────────────────────────

export function verificationEmailHtml(verifyUrl: string): string {
  return base(
    "Vérifiez votre adresse email",
    `<p style="color:#374151;font-size:16px">Bonjour,</p>
     <p style="color:#374151;font-size:16px">
       Merci de vous être inscrit sur Praxisa. Cliquez sur le bouton
       ci-dessous pour confirmer votre adresse email.
     </p>
     <a href="${verifyUrl}"
        style="display:inline-block;background:#4f46e5;color:#fff;
               text-decoration:none;padding:12px 24px;border-radius:6px;
               font-size:16px;margin:16px 0">
       Vérifier mon email
     </a>
     <p style="color:#6b7280;font-size:14px">
       Ce lien expire dans 24&nbsp;heures. Si vous n'avez pas créé de
       compte, ignorez cet email.
     </p>`,
  );
}

export function verificationEmailText(verifyUrl: string): string {
  return text([
    "Bonjour,",
    "Merci de vous être inscrit sur Praxisa. Confirmez votre email en ouvrant ce lien :",
    verifyUrl,
    "Ce lien expire dans 24 heures.",
  ]);
}

// ── Password reset ─────────────────────────────────────────────────────────────

export function passwordResetEmailHtml(resetUrl: string): string {
  return base(
    "Réinitialiser votre mot de passe",
    `<p style="color:#374151;font-size:16px">Bonjour,</p>
     <p style="color:#374151;font-size:16px">
       Vous avez demandé à réinitialiser votre mot de passe Praxisa.
       Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe.
     </p>
     <a href="${resetUrl}"
        style="display:inline-block;background:#4f46e5;color:#fff;
               text-decoration:none;padding:12px 24px;border-radius:6px;
               font-size:16px;margin:16px 0">
       Réinitialiser mon mot de passe
     </a>
     <p style="color:#6b7280;font-size:14px">
       Ce lien expire dans 30&nbsp;minutes. Si vous n'avez pas fait cette
       demande, ignorez cet email.
     </p>`,
  );
}

export function passwordResetEmailText(resetUrl: string): string {
  return text([
    "Bonjour,",
    "Réinitialisez votre mot de passe Praxisa en ouvrant ce lien :",
    resetUrl,
    "Ce lien expire dans 30 minutes.",
  ]);
}

// ── Enrolment confirmation ─────────────────────────────────────────────────────

export function enrolmentConfirmationHtml(
  firstName: string,
  courseName: string,
  courseUrl: string,
): string {
  return base(
    "Inscription confirmée",
    `<p style="color:#374151;font-size:16px">Bonjour ${firstName},</p>
     <p style="color:#374151;font-size:16px">
       Votre inscription à la formation
       <strong>&laquo;&nbsp;${courseName}&nbsp;&raquo;</strong>
       est confirmée. Vous pouvez commencer dès maintenant.
     </p>
     <a href="${courseUrl}"
        style="display:inline-block;background:#4f46e5;color:#fff;
               text-decoration:none;padding:12px 24px;border-radius:6px;
               font-size:16px;margin:16px 0">
       Accéder à la formation
     </a>`,
  );
}

export function enrolmentConfirmationText(
  firstName: string,
  courseName: string,
  courseUrl: string,
): string {
  return text([
    `Bonjour ${firstName},`,
    `Votre inscription à "${courseName}" est confirmée.`,
    `Accédez à votre formation : ${courseUrl}`,
  ]);
}

// ── Course completion ──────────────────────────────────────────────────────────

export function courseCompletionHtml(
  firstName: string,
  courseName: string,
): string {
  return base(
    "Formation terminée",
    `<p style="color:#374151;font-size:16px">
       Félicitations ${firstName}&nbsp;!
     </p>
     <p style="color:#374151;font-size:16px">
       Vous avez terminé la formation
       <strong>&laquo;&nbsp;${courseName}&nbsp;&raquo;</strong>.
       Votre parcours est complet.
     </p>`,
  );
}

export function courseCompletionText(
  firstName: string,
  courseName: string,
): string {
  return text([
    `Félicitations ${firstName} !`,
    `Vous avez terminé la formation "${courseName}".`,
  ]);
}
