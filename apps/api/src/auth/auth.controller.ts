import { Body, Controller, Get, Post } from '@nestjs/common';
import { Publico } from '../common/decorators';
import { Usuario, type UsuarioLogado } from '../common/usuario-logado';
import { LoginDto, RegistrarDto } from './auth.dto';
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

  @Get('eu')
  eu(@Usuario() usuario: UsuarioLogado) {
    return this.auth.eu(usuario.id);
  }
}
