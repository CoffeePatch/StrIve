-- CreateIndex
CREATE INDEX "idx_user_library_status_added" ON "user_library_items"("user_id", "status", "added_at" DESC);

-- CreateIndex
CREATE INDEX "idx_user_library_status_watched" ON "user_library_items"("user_id", "status", "last_watched_at" DESC);

-- CreateIndex
CREATE INDEX "idx_user_list_items_position" ON "user_list_items"("list_id", "position" ASC);
