import { Body, CanActivate, Controller, Get, HttpCode, Ip, NotFoundException, Post, UseGuards } from '@nestjs/common';
import { registroPublicoLigado } from '../common/ambiente';
import { Publico } from '../common/decorators';
import { LimiteTentativas } from '../common/limite';
import { Usuario, type UsuarioLogado } from '../common/usuario-logado';
import { EsqueciSenhaDto, LoginDto, PrimeiroAcessoDto, RedefinirSenhaDto, RegistrarDto } from './auth.dto';
import { AuthService } from './auth.service';

const primeiroAcessoPorIp = new LimiteTentativas(10, 15 * 60 * 1000);

/** Roda antes da validação do corpo: com o registro desligado a rota simplesmente não existe. */
class RegistroPublicoGuard implements CanActivate {
  canActivate() {
    if (!registroPublicoLigado()) throw new NotFoundException();
    return true;
  }
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Publico()
  @Post('login')
  login(@Body() dto: LoginDto, @Ip() ip: string) {
    return this.auth.login(dto, ip);
  }

  /** A tela de login usa para saber se deve mandar para o primeiro acesso. */
  @Publico()
  @Get('primeiro-acesso')
  primeiroAcessoDisponivel() {
    return this.auth.primeiroAcessoDisponivel();
  }

  /** Cria o primeiro administrador. Só funciona enquanto não existe nenhum usuário. */
  @Publico()
  @Post('primeiro-acesso')
  primeiroAcesso(@Body() dto: PrimeiroAcessoDto, @Ip() ip: string) {
    primeiroAcessoPorIp.registrar(ip);
    return this.auth.primeiroAcesso(dto);
  }

  /** Cadastro de empresa nova (SaaS do Verissimo): só com REGISTRO_PUBLICO=true (ADR-007). */
  @Publico()
  @UseGuards(RegistroPublicoGuard)
  @Post('registrar')
  registrar(@Body() dto: RegistrarDto) {
    return this.auth.registrar(dto);
  }

  @Publico()
  @Post('esqueci-senha')
  @HttpCode(200)
  esqueciSenha(@Body() dto: EsqueciSenhaDto, @Ip() ip: string) {
    return this.auth.esqueciSenha(dto, ip);
  }

  @Publico()
  @Post('redefinir-senha')
  @HttpCode(200)
  redefinirSenha(@Body() dto: RedefinirSenhaDto) {
    return this.auth.redefinirSenha(dto);
  }

  @Get('eu')
  eu(@Usuario() usuario: UsuarioLogado) {
    return this.auth.eu(usuario.id);
  }
}
