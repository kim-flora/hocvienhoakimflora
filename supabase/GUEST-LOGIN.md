# Kim Flora: khách phải đăng nhập bằng mật khẩu

## Mô hình quyền
- Khách: Supabase Auth (email + mật khẩu), chỉ đọc và tìm kiếm.
- Quản trị viên: Supabase Auth + UID có trong private.kim_flora_admins; được ghi/xóa.
- Không tạo tài khoản khách bằng mã PIN nhúng vào HTML. Tạo tài khoản khách ở Supabase Authentication > Users.
- Tắt công khai đăng ký (Authentication > Providers > Email > Confirm email / allow sign-ups) nếu chỉ cho khách được mời.

## Migration
Chạy guest-login-migration.sql trong SQL Editor sau khi đã tạo schema gốc.
Lưu ý phải làm ở thời điểm triển khai cùng UI đăng nhập, bởi vì trước đó client đọc ẩn danh sẽ ngừng hoạt động.

## Trở ngại bảo mật bắt buộc xử lý trước khi triển khai
Repo Github Pages đang PUBLIC và index.html đã chứa toàn bộ tài liệu bài học. Mọi người vẫn có thể tải file HTML bằng URL raw/github dù giao diện có màn hình login. Cần:
1. Dời nội dung bài học cần bảo vệ ra khỏi index.html và phiên bản HTML cũ trong repo public; dựng một vỏ ứng dụng không chứa dữ liệu.
2. Chỉ tải dữ liệu từ Supabase sau khi đăng nhập, với chính sách SELECT authenticated như migration.
3. Đối với hình ảnh bảo vệ: dùng private bucket và signed URLs sau xác thực, không dùng public URL.
4. Đảm bảo khách không thể ghi qua API (RLS) và không chỉ ẩn nút chỉnh sửa.
5. Duy trì bản sao lưu và xác minh data migration trước khi gỡ dữ liệu khỏi HTML.
6. Lịch sử commit GitHub PUBLIC vẫn giữ nội dung cũ: có thể cần repo PRIVATE mới để bảo vệ bản gốc, GitHub Pages deployment phải dùng shell độc lập.

## Trạng thái
Chưa triển khai lên production. Không được gọi website hiện tại là riêng tư hoặc đã khóa thật.
