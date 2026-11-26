-- Chạy MỘT lần trên database đã tạo từ schema cũ, ngay trước khi deploy Worker mới.
-- rev: số thứ tự do server gán cho mỗi lần ghi được chấp nhận, dùng làm mốc kéo về.
ALTER TABLE notes ADD COLUMN rev INTEGER NOT NULL DEFAULT 0;
UPDATE notes SET rev = rowid;
CREATE INDEX IF NOT EXISTS idx_notes_rev ON notes(rev);
