'use client';

import { Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { AcoesFormulario, Alerta, Botao, Cabecalho, Caixa, Campo, Celula, Etiqueta, Modal, Tabela } from '@/components/ui';
import { api } from '@/lib/api';
import { moeda } from '@/lib/formato';
import type { ContaBancaria } from '@/lib/tipos';
import { useDados } from '@/lib/use-dados';

const vazio = { nome: '', banco: '', agencia: '', conta: '', saldoInicial: '0', ativa: true };

export default function CaixaEBancos() {
  const { dados, erro, carregando, recarregar } = useDados<ContaBancaria[]>('/financeiro/contas');
  const [editando, setEditando] = useState<string | null>(null);
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState(vazio);
  const [erroForm, setErroForm] = useState('');
  const [salvando, setSalvando] = useState(false);

  function abrir(c?: ContaBancaria) {
    setErroForm('');
    setEditando(c?.id ?? null);
    setForm(
      c
        ? { nome: c.nome, banco: c.banco ?? '', agencia: c.agencia ?? '', conta: c.conta ?? '', saldoInicial: String(Number(c.saldoInicial)), ativa: c.ativa }
        : vazio,
    );
    setAberto(true);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    try {
      await api(editando ? `/financeiro/contas/${editando}` : '/financeiro/contas', {
        metodo: editando ? 'PATCH' : 'POST',
        corpo: { ...form, saldoInicial: Number(form.saldoInicial) },
      });
      setAberto(false);
      await recarregar();
    } catch (e) {
      setErroForm((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  const campo = (nome: keyof typeof vazio) => ({
    value: form[nome] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [nome]: e.target.value }),
  });
  const total = dados?.filter((c) => c.ativa).reduce((s, c) => s + c.saldoAtual, 0) ?? 0;

  return (
    <>
      <Cabecalho titulo="Caixa e bancos" descricao={`Saldo total: ${moeda(total)}`}>
        <Botao onClick={() => abrir()}>
          <Plus className="size-4" /> Nova conta
        </Botao>
      </Cabecalho>
      <Alerta>{erro}</Alerta>

      <Tabela cabecalhos={['Conta', 'Banco', 'Agência / Conta', 'Saldo inicial', 'Saldo atual', '', '']} vazio={dados?.length === 0} carregando={carregando && !dados}>
        {dados?.map((c) => (
          <tr key={c.id} className="hover:bg-slate-50">
            <Celula className="font-medium text-slate-900">{c.nome}</Celula>
            <Celula>{c.banco ?? '—'}</Celula>
            <Celula>{c.agencia || c.conta ? `${c.agencia ?? ''} / ${c.conta ?? ''}` : '—'}</Celula>
            <Celula className="tabular-nums">{moeda(c.saldoInicial)}</Celula>
            <Celula className={`font-medium tabular-nums ${c.saldoAtual < 0 ? 'text-rose-600' : 'text-slate-900'}`}>{moeda(c.saldoAtual)}</Celula>
            <Celula>{!c.ativa && <Etiqueta>Inativa</Etiqueta>}</Celula>
            <Celula className="text-right">
              <Botao variante="fantasma" onClick={() => abrir(c)} aria-label="Editar">
                <Pencil className="size-4" />
              </Botao>
            </Celula>
          </tr>
        ))}
      </Tabela>
      <p className="mt-3 text-sm text-slate-500">O saldo atual é o saldo inicial mais os recebimentos menos os pagamentos baixados em cada conta.</p>

      <Modal titulo={editando ? 'Editar conta' : 'Nova conta'} aberto={aberto} aoFechar={() => setAberto(false)}>
        <form onSubmit={salvar} className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Nome" placeholder="Ex.: Banco do Brasil, Caixa da loja" required className="sm:col-span-2" {...campo('nome')} />
          <Campo rotulo="Banco" {...campo('banco')} />
          <Campo rotulo="Saldo inicial" type="number" step="0.01" {...campo('saldoInicial')} />
          <Campo rotulo="Agência" {...campo('agencia')} />
          <Campo rotulo="Conta" {...campo('conta')} />
          <div className="sm:col-span-2">
            <Caixa rotulo="Conta ativa" checked={form.ativa} onChange={(e) => setForm({ ...form, ativa: e.target.checked })} />
          </div>
          <div className="sm:col-span-2">
            <Alerta>{erroForm}</Alerta>
            <AcoesFormulario aoCancelar={() => setAberto(false)} salvando={salvando} />
          </div>
        </form>
      </Modal>
    </>
  );
}
