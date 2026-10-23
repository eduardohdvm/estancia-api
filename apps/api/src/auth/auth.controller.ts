import { Body, Controller, Get, HttpCode, Ip, Post } from '@nestjs/common';
import { Publico } from '../common/decorators';
import { Usuario, type UsuarioLogado } from '../common/usuario-logado';
import { EsqueciSenhaDto, LoginDto, RedefinirSenhaDto, RegistrarDto } from './auth.dto';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Publico()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Publico()
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
