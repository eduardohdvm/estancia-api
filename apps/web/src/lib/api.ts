// Em desenvolvimento aponta para a API local (veja .env.local). Em produção o site
// é servido pela própria API, então basta o caminho relativo.
const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';
const CHAVE_TOKEN = 'verissimo:token';

export class ErroApi extends Error {
  constructor(
    public status: number,
    mensagem: string,
  ) {
    super(mensagem);
  }
}

export const token = {
  ler: () => (typeof window === 'undefined' ? null : localStorage.getItem(CHAVE_TOKEN)),
  salvar: (valor: string) => localStorage.setItem(CHAVE_TOKEN, valor),
  limpar: () => localStorage.removeItem(CHAVE_TOKEN),
};

/** Chama a API já com o token de login. Lança ErroApi com a mensagem do servidor. */
export async function api<T = unknown>(caminho: string, opcoes: { metodo?: string; corpo?: unknown } = {}): Promise<T> {
  const t = token.ler();
  let resposta: Response;
  try {
    resposta = await fetch(API_URL + caminho, {
      method: opcoes.metodo ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(t ? { Authorization: `Bearer ${t}` } : {}),
      },
      body: opcoes.corpo === undefined ? undefined : JSON.stringify(opcoes.corpo),
    });
  } catch {
    throw new ErroApi(0, 'Não foi possível conectar ao servidor. Verifique se a API está rodando.');
  }

  if (resposta.status === 401 && t && !caminho.startsWith('/auth/')) {
    token.limpar();
    window.location.href = '/login';
  }
  if (resposta.status === 204) return undefined as T;

  const dados = await resposta.json().catch(() => null);
  if (!resposta.ok) {
    const msg = dados?.message;
    throw new ErroApi(resposta.status, Array.isArray(msg) ? msg.join('\n') : (msg ?? 'Erro inesperado'));
  }
  return dados as T;
}

/** Monta a query string ignorando campos vazios. */
export function qs(params: Record<string, string | number | boolean | undefined | null>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
}
