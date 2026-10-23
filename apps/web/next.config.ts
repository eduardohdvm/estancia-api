import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // O build gera o site como arquivos estáticos (pasta `out`), que a API entrega
  // em produção. Assim tudo roda em um único serviço, no mesmo endereço.
  output: 'export',
  trailingSlash: true,
};

export default nextConfig;
