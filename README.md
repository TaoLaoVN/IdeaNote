# IdeaNote

Ghi bug / ý tưởng trên điện thoại, đồng bộ về PC qua Cloudflare.

## 1. Backend (làm 1 lần)
```
cd backend
npx wrangler login
npx wrangler d1 create ideanote        # dán database_id vào wrangler.toml
npx wrangler d1 execute ideanote --remote --file=schema.sql
npx wrangler secret put API_SECRET     # tự đặt 1 mã bí mật dài
npx wrangler deploy                    # nhận được URL *.workers.dev
```

### Nâng cấp từ bản cũ (mốc đồng bộ mới)
Chỉ dành cho database tạo trước khi có cột `rev`. Chạy đúng thứ tự, deploy ngay sau migration:
```
cd backend
npx wrangler d1 execute ideanote --remote --file=migrations/001_add_rev.sql   # chỉ chạy MỘT lần
npx wrangler deploy
```
Sau đó build lại APK (mục 2) và cài trên mọi máy. Lần đồng bộ đầu tiên, mỗi máy tự đẩy và kéo lại toàn bộ, nên lấy được cả ghi chú từng bị sót.

## 2. Build APK cho Android
```
cd app
npx eas-cli@latest login
npx eas-cli@latest build -p android --profile preview
```
Build xong EAS cho link tải APK, mở link trên điện thoại để cài.

## 3. Dùng
Mở app, bấm ⚙️, nhập URL Worker và mã bí mật. Nút 📋 chép danh sách việc đang mở thành prompt để dán vào Claude Code.

## Tính năng bổ sung
- **Thùng rác + hoàn tác**: xoá là có nút "HOÀN TÁC" 6 giây; ghi chú đã xoá nằm trong bộ lọc 🗑 Thùng rác 30 ngày, bấm để khôi phục.
- **Checklist** trong ghi chú (hiện tiến độ ☑ x/y trên thẻ, có trong prompt).
- **Nhắc việc**: chọn nhanh 1 giờ / tối nay / sáng mai / tuần sau, báo bằng thông báo của điện thoại.
- **Ảnh chụp màn hình**: đính kèm từ thư viện ảnh (tự thu nhỏ), đồng bộ qua server. Backend đã thêm cột mới và bảng `images` (đã deploy).
