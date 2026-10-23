import { PartialType } from '@nestjs/mapped-types';
import { Transform } from 'class-transformer';
import { IsBoolean, IsDateString, IsEmail, IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min, MinLength, ValidateIf } from 'class-validator';
import { EtapaOportunidade, TipoAtividade } from '../generated/prisma/enums';

const vazioParaNull = () => Transform(({ value }) => (value === '' ? null : value));
const textoParaBooleano = () => Transform(({ value }) => value === 'true' || value === true);

export class CriarOportunidadeDto {
  @IsString()
  @MinLength(2, { message: 'Informe o título do negócio' })
  titulo: string;

  @IsOptional() @vazioParaNull() @ValidateIf((o) => o.pessoaId !== null) @IsUUID() pessoaId?: string | null;
  @IsOptional() @vazioParaNull() @IsString() contatoNome?: string | null;
  @IsOptional() @vazioParaNull() @IsString() contatoTelefone?: string | null;

  @IsOptional()
  @vazioParaNull()
  @ValidateIf((o) => o.contatoEmail !== null)
  @IsEmail({}, { message: 'E-mail inválido' })
  contatoEmail?: string | null;

  @IsOptional() @IsNumber() @Min(0) valorEstimado?: number;
  @IsOptional() @IsEnum(EtapaOportunidade) etapa?: EtapaOportunidade;
  @IsOptional() @vazioParaNull() @ValidateIf((o) => o.responsavelId !== null) @IsUUID() responsavelId?: string | null;
  @IsOptional() @vazioParaNull() @ValidateIf((o) => o.previsaoFechamento !== null) @IsDateString() previsaoFechamento?: string | null;
  @IsOptional() @vazioParaNull() @IsString() origem?: string | null;
  @IsOptional() @vazioParaNull() @IsString() motivoPerda?: string | null;
  @IsOptional() @vazioParaNull() @IsString() observacoes?: string | null;
}

export class AtualizarOportunidadeDto extends PartialType(CriarOportunidadeDto) {}

export class FiltroOportunidadeDto {
  @IsOptional() @IsString() busca?: string;
  @IsOptional() @IsUUID() responsavelId?: string;
  @IsOptional() @IsUUID() pessoaId?: string;

  /** Inclui ganhos e perdidos (por padrão só aparecem os fechados nos últimos 30 dias). */
  @IsOptional() @textoParaBooleano() @IsBoolean() todasFechadas?: boolean;
}

export class CriarAtividadeDto {
  @IsEnum(TipoAtividade)
  tipo: TipoAtividade;

  @IsString()
  @MinLength(2, { message: 'Descreva a atividade' })
  descricao: string;

  @IsOptional() @IsUUID() oportunidadeId?: string;
  @IsOptional() @IsUUID() pessoaId?: string;
  @IsOptional() @IsDateString() agendadaPara?: string;
  @IsOptional() @IsBoolean() concluida?: boolean;
}

export class AtualizarAtividadeDto {
  @IsOptional() @IsEnum(TipoAtividade) tipo?: TipoAtividade;
  @IsOptional() @IsString() @MinLength(2) descricao?: string;
  @IsOptional() @vazioParaNull() @ValidateIf((o) => o.agendadaPara !== null) @IsDateString() agendadaPara?: string | null;
  @IsOptional() @IsBoolean() concluida?: boolean;
}

export class FiltroAtividadeDto {
  @IsOptional() @IsUUID() oportunidadeId?: string;
  @IsOptional() @IsUUID() pessoaId?: string;
  /** Só tarefas não concluídas. */
  @IsOptional() @textoParaBooleano() @IsBoolean() pendentes?: boolean;
  /** Só atividades do usuário logado. */
  @IsOptional() @textoParaBooleano() @IsBoolean() minhas?: boolean;
}
