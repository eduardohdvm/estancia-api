// Roda antes de `prisma migrate deploy` no start:prod: se o ambiente apontar para o banco
// errado ou faltar segredo, nada é migrado e o deploy falha aqui.
import 'dotenv/config';
import { appEnv, conferirBancos, conferirSegredos } from './common/ambiente';

const ambiente = appEnv();
conferirSegredos(ambiente);
console.log(`Ambiente ${ambiente}: bancos conferidos (${conferirBancos(ambiente).join(', ')})`);
