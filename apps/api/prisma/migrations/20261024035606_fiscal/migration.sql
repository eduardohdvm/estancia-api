-- CreateEnum
CREATE TYPE "AmbienteFiscal" AS ENUM ('SIMULACAO', 'HOMOLOGACAO', 'PRODUCAO');

-- CreateEnum
CREATE TYPE "ModeloNota" AS ENUM ('NFE', 'NFCE');

-- CreateEnum
CREATE TYPE "StatusNota" AS ENUM ('AUTORIZADA', 'REJEITADA', 'CANCELADA', 'DENEGADA');

-- AlterTable
ALTER TABLE "Pessoa" ADD COLUMN     "codigoMunicipio" TEXT,
ADD COLUMN     "complemento" TEXT,
ADD COLUMN     "inscricaoEstadual" TEXT;

-- AlterTable
ALTER TABLE "Produto" ADD COLUMN     "cest" TEXT,
ADD COLUMN     "cfop" TEXT,
ADD COLUMN     "csosn" TEXT,
ADD COLUMN     "ncm" TEXT,
ADD COLUMN     "origem" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ConfiguracaoFiscal" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "razaoSocial" TEXT NOT NULL,
    "nomeFantasia" TEXT,
    "cnpj" TEXT NOT NULL,
    "inscricaoEstadual" TEXT NOT NULL,
    "inscricaoMunicipal" TEXT,
    "cnae" TEXT,
    "crt" INTEGER NOT NULL DEFAULT 1,
    "logradouro" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "complemento" TEXT,
    "bairro" TEXT NOT NULL,
    "codigoMunicipio" TEXT NOT NULL,
    "municipio" TEXT NOT NULL,
    "uf" TEXT NOT NULL,
    "cep" TEXT NOT NULL,
    "telefone" TEXT,
    "ambiente" "AmbienteFiscal" NOT NULL DEFAULT 'SIMULACAO',
    "serieNfe" INTEGER NOT NULL DEFAULT 1,
    "proximoNumeroNfe" INTEGER NOT NULL DEFAULT 1,
    "serieNfce" INTEGER NOT NULL DEFAULT 1,
    "proximoNumeroNfce" INTEGER NOT NULL DEFAULT 1,
    "cfopPadrao" TEXT NOT NULL DEFAULT '5102',
    "csosnPadrao" TEXT NOT NULL DEFAULT '102',
    "informacoesAdicionais" TEXT,
    "emitirNfceNoPdv" BOOLEAN NOT NULL DEFAULT false,
    "cscId" TEXT,
    "cscToken" TEXT,
    "certificado" TEXT,
    "certificadoSenha" TEXT,
    "certificadoTitular" TEXT,
    "certificadoValidade" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfiguracaoFiscal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotaFiscal" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "modelo" "ModeloNota" NOT NULL,
    "serie" INTEGER NOT NULL,
    "numero" INTEGER NOT NULL,
    "chave" TEXT NOT NULL,
    "ambiente" "AmbienteFiscal" NOT NULL,
    "status" "StatusNota" NOT NULL,
    "pedidoId" TEXT,
    "destinatarioNome" TEXT,
    "destinatarioDocumento" TEXT,
    "valorTotal" DECIMAL(14,2) NOT NULL,
    "xml" TEXT NOT NULL,
    "xmlAutorizado" TEXT,
    "protocolo" TEXT,
    "codigoStatus" INTEGER,
    "motivo" TEXT,
    "qrCode" TEXT,
    "urlConsulta" TEXT,
    "autorizadaEm" TIMESTAMP(3),
    "canceladaEm" TIMESTAMP(3),
    "protocoloCancelamento" TEXT,
    "justificativaCancelamento" TEXT,
    "xmlCancelamento" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotaFiscal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConfiguracaoFiscal_empresaId_key" ON "ConfiguracaoFiscal"("empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "NotaFiscal_chave_key" ON "NotaFiscal"("chave");

-- CreateIndex
CREATE INDEX "NotaFiscal_empresaId_createdAt_idx" ON "NotaFiscal"("empresaId", "createdAt");

-- CreateIndex
CREATE INDEX "NotaFiscal_pedidoId_idx" ON "NotaFiscal"("pedidoId");

-- CreateIndex
CREATE UNIQUE INDEX "NotaFiscal_empresaId_modelo_serie_numero_key" ON "NotaFiscal"("empresaId", "modelo", "serie", "numero");

-- AddForeignKey
ALTER TABLE "ConfiguracaoFiscal" ADD CONSTRAINT "ConfiguracaoFiscal_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotaFiscal" ADD CONSTRAINT "NotaFiscal_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotaFiscal" ADD CONSTRAINT "NotaFiscal_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "PedidoVenda"("id") ON DELETE SET NULL ON UPDATE CASCADE;
