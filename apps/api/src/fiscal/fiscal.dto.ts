import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { AmbienteFiscal, ModeloNota, StatusNota } from '../generated/prisma/enums';
import { CODIGO_UF } from './chave';
import { PaginacaoDto } from '../common/paginacao';

const soDigitos = () => Transform(({ value }) => (typeof value === 'string' ? value.replace(/\D/g, '') : value));
const vazioParaNull = () => Transform(({ value }) => (value === '' ? null : value));

export const CSOSN_SUPORTADOS = ['101', '102', '103', '300', '400', '500', '900'];

export class ConfiguracaoFiscalDto {
  @IsString() @MinLength(2) @MaxLength(60) razaoSocial: string;
  @IsOptional() @vazioParaNull() @IsString() @MaxLength(60) nomeFantasia?: string | null;
  @soDigitos() @Matches(/^\d{14}$/, { message: 'CNPJ deve ter 14 dígitos' }) cnpj: string;
  @soDigitos() @Matches(/^\d{2,14}$/, { message: 'Inscrição estadual inválida' }) inscricaoEstadual: string;
  @IsOptional() @vazioParaNull() @soDigitos() @IsString() inscricaoMunicipal?: string | null;
  @IsOptional() @vazioParaNull() @soDigitos() @Matches(/^\d{7}$/, { message: 'CNAE deve ter 7 dígitos' }) cnae?: string | null;
  @IsInt() @IsIn([1, 4], { message: 'Por enquanto só Simples Nacional (CRT 1) e MEI (CRT 4) são suportados' }) crt: number;
  @IsString() @MinLength(2) logradouro: string;
  @IsString() @MinLength(1) numero: string;
  @IsOptional() @vazioParaNull() @IsString() complemento?: string | null;
  @IsString() @MinLength(2) bairro: string;
  @soDigitos() @Matches(/^\d{7}$/, { message: 'Código do município (IBGE) deve ter 7 dígitos' }) codigoMunicipio: string;
  @IsString() @MinLength(2) municipio: string;
  @IsIn(Object.keys(CODIGO_UF), { message: 'UF inválida' }) uf: string;
  @soDigitos() @Matches(/^\d{8}$/, { message: 'CEP deve ter 8 dígitos' }) cep: string;
  @IsOptional() @vazioParaNull() @IsString() telefone?: string | null;
  @IsEnum(AmbienteFiscal) ambiente: AmbienteFiscal;
  @IsInt() @Min(0) @Max(889) serieNfe: number;
  @IsInt() @Min(1) @Max(999_999_999) proximoNumeroNfe: number;
  @IsInt() @Min(0) @Max(889) serieNfce: number;
  @IsInt() @Min(1) @Max(999_999_999) proximoNumeroNfce: number;
  @Matches(/^5\d{3}$/, { message: 'CFOP padrão deve ser de venda dentro do estado (5xxx)' }) cfopPadrao: string;
  @IsIn(CSOSN_SUPORTADOS, { message: 'CSOSN não suportado' }) csosnPadrao: string;
  @IsOptional() @vazioParaNull() @IsString() @MaxLength(2000) informacoesAdicionais?: string | null;
  @IsBoolean() emitirNfceNoPdv: boolean;
  @IsOptional() @vazioParaNull() @soDigitos() @Matches(/^\d{1,6}$/, { message: 'Identificador do CSC deve ter até 6 dígitos' }) cscId?: string | null;
  /** Vazio mantém o CSC atual; null remove. */
  @IsOptional() @IsString() @MaxLength(36) cscToken?: string | null;
}

export class CertificadoDto {
  /** Arquivo .pfx em base64. */
  @IsString() @MinLength(100, { message: 'Arquivo do certificado inválido' }) arquivo: string;
  @IsString() senha: string;
}

export class EmitirNfceDto {
  /** CPF ou CNPJ do consumidor ("CPF na nota"). */
  @IsOptional() @vazioParaNull() @soDigitos() @Matches(/^(\d{11}|\d{14})$/, { message: 'CPF/CNPJ inválido' }) documento?: string | null;
}

export class CancelarNotaDto {
  @IsString() @MinLength(15, { message: 'A justificativa precisa ter pelo menos 15 caracteres' }) @MaxLength(255) justificativa: string;
}

export class FiltroNotaDto extends PaginacaoDto {
  @IsOptional() @IsEnum(ModeloNota) modelo?: ModeloNota;
  @IsOptional() @IsEnum(StatusNota) status?: StatusNota;
  @IsOptional() @IsString() pedidoId?: string;
}
