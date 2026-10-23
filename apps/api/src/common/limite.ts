import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Limite simples de tentativas por chave (ex.: IP ou e-mail), guardado em memória.
 * Serve para um servidor só; com vários servidores, trocar por Redis.
 */
export class LimiteTentativas {
  private readonly tentativas = new Map<string, number[]>();

  constructor(
    private readonly maximo: number,
    private readonly janelaMs: number,
  ) {}

  /** Registra uma tentativa; lança 429 se a chave passou do limite na janela de tempo. */
  registrar(chave: string) {
    const agora = Date.now();
    const recentes = (this.tentativas.get(chave) ?? []).filter((t) => agora - t < this.janelaMs);
    if (recentes.length >= this.maximo) {
      throw new HttpException('Muitas tentativas. Aguarde alguns minutos e tente de novo.', HttpStatus.TOO_MANY_REQUESTS);
    }
    recentes.push(agora);
    this.tentativas.set(chave, recentes);
    // Limpeza ocasional para o mapa não crescer para sempre.
    if (this.tentativas.size > 10_000) {
      for (const [k, v] of this.tentativas) if (v.every((t) => agora - t >= this.janelaMs)) this.tentativas.delete(k);
    }
  }
}
