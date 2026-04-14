-- CreateIndex
CREATE INDEX "Rfq_createdById_idx" ON "Rfq"("createdById");

-- CreateIndex
CREATE INDEX "Rfq_assignedPricingUserId_idx" ON "Rfq"("assignedPricingUserId");

-- CreateIndex
CREATE INDEX "Rfq_status_idx" ON "Rfq"("status");

-- CreateIndex
CREATE INDEX "Rfq_companyId_idx" ON "Rfq"("companyId");

-- CreateIndex
CREATE INDEX "QuoteRevision_rfqId_idx" ON "QuoteRevision"("rfqId");

-- CreateIndex
CREATE INDEX "Attachment_rfqId_idx" ON "Attachment"("rfqId");

-- CreateIndex
CREATE INDEX "Attachment_quoteRevisionId_idx" ON "Attachment"("quoteRevisionId");

-- CreateIndex
CREATE INDEX "Contact_companyId_idx" ON "Contact"("companyId");

-- CreateIndex
CREATE INDEX "Lead_companyId_idx" ON "Lead"("companyId");

-- CreateIndex
CREATE INDEX "Lead_ownerId_idx" ON "Lead"("ownerId");
