-- The status-leading index cannot directly supply global chronological order.
CREATE INDEX "AlertEvent_createdAt_id_idx" ON "AlertEvent"("createdAt", "id");
