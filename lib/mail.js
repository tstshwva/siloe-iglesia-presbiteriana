import nodemailer from 'nodemailer';

export function mailStatus() {
  return { configured: Boolean(process.env.SMTP_HOST && process.env.MAIL_FROM), provider: process.env.SMTP_HOST ? 'SMTP' : process.env.RESET_WEBHOOK ? 'Webhook' : 'Sin configurar' };
}
export async function deliverReset(user, token, churchName) {
  const recipient = user.recovery_email || user.recoveryEmail || user.email;
  const origin = process.env.APP_URL || `http://127.0.0.1:${process.env.PORT || 3000}`;
  const link = `${origin.replace(/\/$/, '')}/${user.role === 'miembro' ? 'comunidad' : 'admin'}#restablecer=${encodeURIComponent(token)}`;
  await sendAccountMail(recipient, `${churchName} · Recuperar contraseña`, `Hola ${user.name},\n\nSolicitaste recuperar tu acceso a ${churchName}.\nAbre este enlace: ${link}\n\nTambién puedes usar este código: ${token}\nVence en 30 minutos y solo se puede utilizar una vez.\nSi no lo solicitaste, ignora este correo.`, token, 'Recuperación', link);
}
export async function deliverVerification(user, token, churchName) {
  const origin = process.env.APP_URL || `http://127.0.0.1:${process.env.PORT || 3000}`;
  const link = `${origin.replace(/\/$/, '')}/comunidad#verificar=${encodeURIComponent(token)}`;
  await sendAccountMail(user.email, `${churchName} · Verifica tu correo`, `Hola ${user.name},\n\nConfirma tu correo abriendo: ${link}\n\nO introduce este código en la página de la comunidad: ${token}\nEl enlace vence en 24 horas. Después de verificar, el administrador revisará tu solicitud.\nSi no creaste esta cuenta, ignora el mensaje.`, token, 'Verificación', link);
}
async function sendAccountMail(recipient, subject, message, token, kind, link) {
  if (process.env.SMTP_HOST && process.env.MAIL_FROM) {
    const port = Number(process.env.SMTP_PORT || 587);
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST, port, secure: port === 465,
      requireTLS: process.env.NODE_ENV === 'production' || process.env.SMTP_REQUIRE_TLS !== 'false',
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
      connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
    });
    await transporter.sendMail({ from: process.env.MAIL_FROM, to: recipient,
      subject, text: message,
    });
  } else if (process.env.RESET_WEBHOOK) {
    const response = await fetch(process.env.RESET_WEBHOOK, { method: 'POST', signal: AbortSignal.timeout(15000),
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.RESET_WEBHOOK_SECRET || ''}` },
      body: JSON.stringify({ email: recipient, token, link, subject, text: message, kind: kind === 'Verificación' ? 'verification' : 'reset', expiresMinutes: kind === 'Verificación' ? 1440 : 30 }) });
    if (!response.ok) throw Error('El servicio de correo rechazó el envío.');
  } else if (process.env.NODE_ENV !== 'production') {
    console.log(`${kind} local para ${recipient}: ${token}`);
  } else throw Error('Correo sin configurar.');
}
