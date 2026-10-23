-- CreateEnum
CREATE TYPE "OrigemPedido" AS ENUM ('PEDIDO', 'PDV');

-- CreateEnum
CREATE TYPE "StatusCaixa" AS ENUM ('ABERTO', 'FECHADO');

-- CreateEnum
CREATE TYPE "FormaPagamento" AS ENUM ('DINHEIRO', 'PIX', 'CARTAO_DEBITO', 'CARTAO_CREDITO', 'CREDIARIO');

-- CreateEnum
CREATE TYPE "TipoMovimentoCaixa" AS ENUM ('SUPRIMENTO', 'SANGRIA');

-- CreateEnum
CREATE TYPE "StatusCompra" AS ENUM ('RASCUNHO', 'ENVIADO', 'RECEBIDO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "EtapaOportunidade" AS ENUM ('PROSPECCAO', 'QUALIFICACAO', 'PROPOSTA', 'NEGOCIACAO', 'GANHO', 'PERDIDO');

-- CreateEnum
CREATE TYPE "TipoAtividade" AS ENUM ('LIGACAO', 'WHATSAPP', 'EMAIL', 'REUNIAO', 'VISITA', 'TAREFA', 'NOTA');

-- AlterEnum
ALTER TYPE "Perfil" ADD VALUE 'CAIXA';

-- AlterTable
ALTER TABLE "Lancamento" ADD COLUMN     "pedidoCompraId" TEXT;

-- AlterTable
ALTER TABLE "MovimentoEstoque" ADD COLUMN     "pedidoCompraId" TEXT;

-- AlterTable
ALTER TABLE "PedidoVenda" ADD COLUMN     "caixaId" TEXT,
ADD COLUMN     "origem" "OrigemPedido" NOT NULL DEFAULT 'PEDIDO';

-- CreateTable
CREATE TABLE "Caixa" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "contaBancariaId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "status" "StatusCaixa" NOT NULL DEFAULT 'ABERTO',
    "valorAbertura" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "valorFechamento" DECIMAL(14,2),
    "valorEsperado" DECIMAL(14,2),
    "abertoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechadoEm" TIMESTAMP(3),
    "observacoes" TEXT,

    CONSTRAINT "Caixa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimentoCaixa" (
    "id" TEXT NOT NULL,
    "caixaId" TEXT NOT NULL,
    "tipo" "TipoMovimentoCaixa" NOT NULL,
    "valor" DECIMAL(14,2) NOT NULL,
    "motivo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimentoCaixa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PagamentoVenda" (
    "id" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "caixaId" TEXT,
    "forma" "FormaPagamento" NOT NULL,
    "valor" DECIMAL(14,2) NOT NULL,
    "troco" DECIMAL(14,2) NOT NULL DEFAULT 0,

    CONSTRAINT "PagamentoVenda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PedidoCompra" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "fornecedorId" TEXT NOT NULL,
    "depositoId" TEXT NOT NULL,
    "status" "StatusCompra" NOT NULL DEFAULT 'RASCUNHO',
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "desconto" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "frete" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "parcelas" INTEGER NOT NULL DEFAULT 1,
    "previsaoEntrega" DATE,
    "observacoes" TEXT,
    "recebidoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PedidoCompra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PedidoCompraItem" (
    "id" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "quantidade" DECIMAL(14,3) NOT NULL,
    "custoUnitario" DECIMAL(14,2) NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "PedidoCompraItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Oportunidade" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "pessoaId" TEXT,
    "contatoNome" TEXT,
    "contatoTelefone" TEXT,
    "contatoEmail" TEXT,
    "valorEstimado" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "etapa" "EtapaOportunidade" NOT NULL DEFAULT 'PROSPECCAO',
    "responsavelId" TEXT,
    "previsaoFechamento" DATE,
    "origem" TEXT,
    "motivoPerda" TEXT,
    "observacoes" TEXT,
    "fechadaEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Oportunidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Atividade" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "tipo" "TipoAtividade" NOT NULL,
    "descricao" TEXT NOT NULL,
    "oportunidadeId" TEXT,
    "pessoaId" TEXT,
    "usuarioId" TEXT NOT NULL,
    "agendadaPara" TIMESTAMP(3),
    "concluida" BOOLEAN NOT NULL DEFAULT false,
    "concluidaEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Atividade_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Caixa_empresaId_status_idx" ON "Caixa"("empresaId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Caixa_empresaId_numero_key" ON "Caixa"("empresaId", "numero");

-- CreateIndex
CREATE INDEX "PagamentoVenda_caixaId_idx" ON "PagamentoVenda"("caixaId");

-- CreateIndex
CREATE INDEX "PedidoCompra_empresaId_status_idx" ON "PedidoCompra"("empresaId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PedidoCompra_empresaId_numero_key" ON "PedidoCompra"("empresaId", "numero");

-- CreateIndex
CREATE INDEX "Oportunidade_empresaId_etapa_idx" ON "Oportunidade"("empresaId", "etapa");

-- CreateIndex
CREATE INDEX "Atividade_empresaId_usuarioId_concluida_idx" ON "Atividade"("empresaId", "usuarioId", "concluida");

-- CreateIndex
CREATE INDEX "Atividade_oportunidadeId_idx" ON "Atividade"("oportunidadeId");

-- CreateIndex
CREATE INDEX "PedidoVenda_caixaId_idx" ON "PedidoVenda"("caixaId");

-- AddForeignKey
ALTER TABLE "MovimentoEstoque" ADD CONSTRAINT "MovimentoEstoque_pedidoCompraId_fkey" FOREIGN KEY ("pedidoCompraId") REFERENCES "PedidoCompra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoVenda" ADD CONSTRAINT "PedidoVenda_caixaId_fkey" FOREIGN KEY ("caixaId") REFERENCES "Caixa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Caixa" ADD CONSTRAINT "Caixa_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Caixa" ADD CONSTRAINT "Caixa_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Caixa" ADD CONSTRAINT "Caixa_contaBancariaId_fkey" FOREIGN KEY ("contaBancariaId") REFERENCES "ContaBancaria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentoCaixa" ADD CONSTRAINT "MovimentoCaixa_caixaId_fkey" FOREIGN KEY ("caixaId") REFERENCES "Caixa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PagamentoVenda" ADD CONSTRAINT "PagamentoVenda_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "PedidoVenda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PagamentoVenda" ADD CONSTRAINT "PagamentoVenda_caixaId_fkey" FOREIGN KEY ("caixaId") REFERENCES "Caixa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoCompra" ADD CONSTRAINT "PedidoCompra_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoCompra" ADD CONSTRAINT "PedidoCompra_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Pessoa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoCompra" ADD CONSTRAINT "PedidoCompra_depositoId_fkey" FOREIGN KEY ("depositoId") REFERENCES "Deposito"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoCompraItem" ADD CONSTRAINT "PedidoCompraItem_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "PedidoCompra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoCompraItem" ADD CONSTRAINT "PedidoCompraItem_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Oportunidade" ADD CONSTRAINT "Oportunidade_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Oportunidade" ADD CONSTRAINT "Oportunidade_pessoaId_fkey" FOREIGN KEY ("pessoaId") REFERENCES "Pessoa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Oportunidade" ADD CONSTRAINT "Oportunidade_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Atividade" ADD CONSTRAINT "Atividade_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Atividade" ADD CONSTRAINT "Atividade_oportunidadeId_fkey" FOREIGN KEY ("oportunidadeId") REFERENCES "Oportunidade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Atividade" ADD CONSTRAINT "Atividade_pessoaId_fkey" FOREIGN KEY ("pessoaId") REFERENCES "Pessoa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Atividade" ADD CONSTRAINT "Atividade_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lancamento" ADD CONSTRAINT "Lancamento_pedidoCompraId_fkey" FOREIGN KEY ("pedidoCompraId") REFERENCES "PedidoCompra"("id") ON DELETE SET NULL ON UPDATE CASCADE;
