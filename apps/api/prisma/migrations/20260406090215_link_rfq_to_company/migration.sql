-- AlterTable
ALTER TABLE "CustomerCompany" ADD COLUMN     "notes" TEXT,
ADD COLUMN     "sector" TEXT;

-- AlterTable
ALTER TABLE "Rfq" ADD COLUMN     "companyId" TEXT,
ADD COLUMN     "contactId" TEXT;

-- AddForeignKey
ALTER TABLE "Rfq" ADD CONSTRAINT "Rfq_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "CustomerCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rfq" ADD CONSTRAINT "Rfq_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
