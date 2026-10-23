import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { Prisma } from '../generated/prisma/client';

/** Traduz erros comuns do banco em respostas HTTP amigáveis. */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaErroFilter implements ExceptionFilter {
  catch(erro: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const respostas: Record<string, [number, string]> = {
      P2002: [HttpStatus.CONFLICT, 'Já existe um registro com esses dados'],
      P2003: [HttpStatus.CONFLICT, 'Este registro está sendo usado em outro lugar e não pode ser removido'],
      P2025: [HttpStatus.NOT_FOUND, 'Registro não encontrado'],
    };
    const [status, message] = respostas[erro.code] ?? [HttpStatus.BAD_REQUEST, 'Erro ao gravar no banco de dados'];
    res.status(status).json({ statusCode: status, message });
  }
}
