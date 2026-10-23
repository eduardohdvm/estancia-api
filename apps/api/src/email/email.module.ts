import { Global, Injectable, Logger, Module } from '@nestjs/common';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import nodemailer, { Transporter } from 'nodemailer';

export interface Email {
  para: string;
  assunto: string;
  texto: string;
  html: string;
}

/**
 * Envio de e-mails por SMTP (variáveis SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS e EMAIL_FROM).
 * Sem SMTP configurado, o e-mail é gravado em `.emails/` e aparece no log, para desenvolvimento.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporte: Transporter | null = process.env.SMTP_HOST
    ? nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: process.env.SMTP_PORT === '465',
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
      })
    : null;

  async enviar(email: Email) {
    if (this.transporte) {
      await this.transporte.sendMail({
        from: process.env.EMAIL_FROM ?? process.env.SMTP_USER,
        to: email.para,
        subject: email.assunto,
        text: email.texto,
        html: email.html,
      });
      return;
    }
    const pasta = process.env.EMAIL_PASTA ?? join(process.cwd(), '.emails');
    mkdirSync(pasta, { recursive: true });
    writeFileSync(join(pasta, `${Date.now()}-${email.para.replace(/[^a-z0-9@.]/gi, '_')}.json`), JSON.stringify({ ...email, data: new Date() }, null, 2));
    this.logger.warn(`SMTP não configurado: e-mail para ${email.para} não foi enviado ("${email.assunto}").\n${email.texto}`);
  }
}

@Global()
@Module({
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
