// Endereços dos web services da SEFAZ por estado e ambiente.
// Cada estado é cadastrado aqui depois de conferido na lista oficial do Portal da NF-e
// (nfe.fazenda.gov.br) e no portal da NFC-e do estado (QR Code e consulta).

export interface EnderecosSefaz {
  autorizacao: string;
  evento: string;
  status: string;
}

export interface EnderecosNfce extends EnderecosSefaz {
  qrCode: string; // endereço base do QR Code impresso no cupom
  consulta: string; // endereço de consulta por chave (urlChave)
}

type PorAmbiente<T> = { homologacao: T; producao: T };

const NFE: Record<string, PorAmbiente<EnderecosSefaz>> = {};
const NFCE: Record<string, PorAmbiente<EnderecosNfce>> = {};

export function enderecosNfe(uf: string, producao: boolean) {
  const e = NFE[uf];
  return e ? (producao ? e.producao : e.homologacao) : null;
}

export function enderecosNfce(uf: string, producao: boolean) {
  const e = NFCE[uf];
  return e ? (producao ? e.producao : e.homologacao) : null;
}

export const estadosDisponiveis = () => ({ nfe: Object.keys(NFE), nfce: Object.keys(NFCE) });
