import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Modalidade } from '../generated/prisma/enums';

export class ItemOrcamentoPublicoDto {
  @IsUUID()
  produtoId: string;

  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001, { message: 'A quantidade deve ser maior que zero' })
  @Max(999)
  quantidade: number;
}

export class EnderecoDto {
  @IsOptional() @IsString() @MaxLength(9) cep?: string;
  @IsString() @MinLength(2, { message: 'Informe a rua' }) @MaxLength(120) logradouro: string;
  @IsString() @MinLength(1, { message: 'Informe o número' }) @MaxLength(20) numero: string;
  @IsOptional() @IsString() @MaxLength(60) complemento?: string;
  @IsString() @MinLength(2, { message: 'Informe o bairro' }) @MaxLength(60) bairro: string;
  @IsString() @MinLength(2, { message: 'Informe a cidade' }) @MaxLength(60) cidade: string;
  @IsOptional() @IsString() @MaxLength(120) referencia?: string;
}

export class ClienteOrcamentoDto {
  @IsString()
  @MinLength(2, { message: 'Informe seu nome' })
  @MaxLength(80)
  nome: string;

  @IsString()
  @MinLength(10, { message: 'Informe o telefone com DDD' })
  @MaxLength(20)
  telefone: string;
}

export class CriarOrcamentoPublicoDto {
  /** Gerada pelo aparelho do cliente: reenviar o mesmo pedido devolve o mesmo orçamento. */
  @IsUUID()
  chave: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Adicione pelo menos um produto' })
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ItemOrcamentoPublicoDto)
  itens: ItemOrcamentoPublicoDto[];

  @ValidateNested()
  @Type(() => ClienteOrcamentoDto)
  cliente: ClienteOrcamentoDto;

  @IsEnum(Modalidade)
  modalidade: Modalidade;

  @ValidateIf((o: CriarOrcamentoPublicoDto) => o.modalidade === 'ENTREGA')
  @ValidateNested()
  @Type(() => EnderecoDto)
  endereco?: EnderecoDto;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacao?: string;
}

export class WhatsappAbertoDto {
  @IsUUID()
  chave: string;
}
