-- CreateEnum
CREATE TYPE "Armazenamento" AS ENUM ('AMBIENTE', 'REFRIGERADO', 'CONGELADO');

-- CreateEnum
CREATE TYPE "Modalidade" AS ENUM ('RETIRADA', 'ENTREGA');

-- AlterEnum
ALTER TYPE "OrigemPedido" ADD VALUE 'CATALOGO';

-- AlterTable
ALTER TABLE "Pessoa" ADD COLUMN     "telefoneE164" TEXT;

-- AlterTable
ALTER TABLE "Produto" ADD COLUMN     "armazenamento" "Armazenamento" NOT NULL DEFAULT 'AMBIENTE',
ADD COLUMN     "publicado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "vendaFracionada" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "PedidoVenda" ADD COLUMN     "enderecoEntrega" JSONB,
ADD COLUMN     "modalidade" "Modalidade" NOT NULL DEFAULT 'RETIRADA',
ADD COLUMN     "solicitacaoOriginal" JSONB,
ADD COLUMN     "whatsappAbertoEm" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Pessoa_empresaId_telefoneE164_idx" ON "Pessoa"("empresaId", "telefoneE164");

