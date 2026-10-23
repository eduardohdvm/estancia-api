import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class PaginacaoDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  porPagina = 20;

  @IsOptional()
  @IsString()
  busca?: string;
}

export function paginar({ pagina, porPagina }: PaginacaoDto) {
  return { skip: (pagina - 1) * porPagina, take: porPagina };
}

export function resultado<T>(itens: T[], total: number, { pagina, porPagina }: PaginacaoDto) {
  return { itens, total, pagina, porPagina, paginas: Math.max(1, Math.ceil(total / porPagina)) };
}
