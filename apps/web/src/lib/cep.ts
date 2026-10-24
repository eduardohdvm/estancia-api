// Busca de endereço pelo CEP (ViaCEP, serviço público e gratuito). Também traz o código
// IBGE do município, que a NF-e exige.

export interface EnderecoCep {
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
  codigoMunicipio: string;
}

export async function buscarCep(cep: string): Promise<EnderecoCep | null> {
  const digitos = cep.replace(/\D/g, '');
  if (digitos.length !== 8) return null;
  try {
    const r = await fetch(`https://viacep.com.br/ws/${digitos}/json/`);
    const d = await r.json();
    if (d.erro) return null;
    return { logradouro: d.logradouro ?? '', bairro: d.bairro ?? '', cidade: d.localidade ?? '', uf: d.uf ?? '', codigoMunicipio: d.ibge ?? '' };
  } catch {
    return null;
  }
}
