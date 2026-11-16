# Kim Flora — triển khai đăng nhập khách chỉ bằng mật khẩu

## Mã đã có trên nhánh thử nghiệm
- `guest.html`: giao diện đăng nhập khách (chỉ password), admin (email + password), tạo và thu hồi mật khẩu khách.
- `supabase/password-guest-schema.sql`: bảng hash mật khẩu riêng cho khách, phiên đăng nhập và dấu vết giới hạn thử.
- `supabase/functions/kf-guest-access/index.ts`: endpoint nhận mật khẩu, kiểm tra server-side và xác minh phiên trước khi trả `published/main`.
- `index.html`: đã có thay đổi thử nghiệm từ trước; **chưa merge và không dùng làm bằng chứng bảo mật**.

## Yêu cầu cấu hình Supabase (chưa thực hiện)
1. SQL Editor: sau schema gốc, chạy `supabase/password-guest-schema.sql`. Nếu trước đó chạy `guest-login-migration.sql`, chạy lại chính sách admin-only read trong schema mới.
2. Project Settings → API → Exposed schemas: bổ sung `private` (bảng private KHÔNG được grant cho anon/authenticated; chỉ service_role). Nếu muốn tránh exposed schema private, hãy thay thiết kế bằng SQL SECURITY DEFINER RPC riêng và code Edge tương ứng.
3. Edge Functions: deploy `kf-guest-access` từ đúng thư mục. Với function cho guest không có Supabase JWT, thiết lập `verify_jwt=false` **chỉ cho function này**; mã function phải tự kiểm tra mật khẩu hoặc Admin JWT trước mọi thao tác. Xác minh chính sách bảo mật/tốc độ giới hạn.
4. Supabase Function Secrets: tạo `KF_GUEST_PEPPER` là secret ngẫu nhiên tối thiểu 32 ký tự, không đưa lên repo/HTML. Supabase có `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` ở runtime.
5. Không cung cấp khóa secret/service_role/password/pepper qua chat hay mã GitHub.
6. Tạo dữ liệu được xuất bản có `content_key = published/main`, `content_value = {"html":"..."}` bằng tài khoản admin, sau khi đã kiểm tra dữ liệu và backup. **Hiện chưa có nội dung được xuất bản vào DB.**
7. Kiểm tra (a) sai mật khẩu bị từ chối, (b) mỗi mật khẩu khác nhau cấp phiên riêng, (c) thu hồi có hiệu lực ngay, (d) khách đọc được nhưng không thể sửa dữ liệu qua API, (e) admin có quyền đầy đủ.

## Vấn đề chưa được giải quyết (không thể gọi là triển khai xong)
- Repository public chứa nguyên bài học trong `index.html` và các bản HTML cũ, kể cả lịch sử Git. Chỉ màn hình nhập mật khẩu không thể giấu nội dung cũ; phải di chuyển tài liệu và các asset cần bảo vệ khỏi nơi công khai. Lịch sử Git public có thể vẫn bị truy xuất.
- Bản HTML đầy đủ có nhiều JS quản lý nội dung, hiện `guest.html` render `published/main` bằng iframe sandbox không cho script chạy. Cần chuyển chức năng vào frontend an toàn hoặc chọn chế độ chỉ đọc bảo toàn hiển thị, và kiểm thử kỹ.
- Chưa đồng bộ nội dung/hình ảnh hiện có. Chưa deploy Edge Function/Supabase SQL. Chưa merge. Chưa có link website đã thử nghiệm thực tế.
- Giới hạn thử mật khẩu theo bảng đếm có thể gặp race/concurrent requests và proxy IP giả mạo; cần rate limiter ở cổng API/Edge mức production và monitoring trước khi công khai.
- Không được dùng bản HTML chứa mã PIN quản trị cũ làm nguồn an toàn.
