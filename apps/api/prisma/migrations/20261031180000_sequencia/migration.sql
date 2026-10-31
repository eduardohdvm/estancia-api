-- CreateTable
CREATE TABLE "Sequencia" (
    "empresaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "valor" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Sequencia_pkey" PRIMARY KEY ("empresaId","nome")
);

-- AddForeignKey
ALTER TABLE "Sequencia" ADD CONSTRAINT "Sequencia_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

