# Triển khai Kim Flora: 1 Admin – nhiều Guest, mỗi khách mật khẩu riêng

## Đã chuẩn bị trên nhánh thử nghiệm
- `index.html` cũ được giữ nội dung, chỉ thêm cổng đăng nhập và tham chiếu module.
- `kim-flora-live.js` đăng nhập Supabase bằng email/mật khẩu, xác định admin qua `kf_is_admin()`, giao diện khách chỉ xem/tìm kiếm, đăng xuất, đổi mật khẩu admin, sao lưu và đồng bộ thủ công.
- `supabase/functions/invite-kf-guest/index.ts` dùng service_role **chỉ ở phía Supabase** để gửi email mời từng khách; đòi hỏi phiên đăng nhập và quyền admin.
- `supabase/guest-login-migration.sql` yêu cầu đăng nhập mới SELECT được `kf_content`.

## Việc còn lại trên Supabase (không thể thực hiện bằng GitHub)
1. SQL Editor: chạy `supabase/guest-login-migration.sql` **sau khi** xác nhận schema gốc hoạt động. Kiểm tra khách chưa đăng nhập không SELECT, khách đăng nhập được SELECT nhưng không thể INSERT/UPDATE/DELETE.
2. Authentication → Providers → Email: hạn chế đăng ký tự do theo cấu hình dự án; khách chỉ được cấp qua lời mời của quản trị viên.
3. Deploy Edge Function `invite-kf-guest` từ thư mục `supabase/functions/invite-kf-guest`. Duy trì xác thực JWT hoặc tự kiểm tra JWT trong function như đã viết; không tắt bảo mật tùy tiện. Kiểm tra các env `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` trong Supabase (không đưa vào GitHub).
4. Cấu hình Site URL và Redirect URLs đúng địa chỉ GitHub Pages để khách bấm link mời rồi đặt mật khẩu.
5. Tạo tài khoản test của khách A/B; xác nhận A/B không có UID trong `private.kim_flora_admins`.

## Quan trọng: chưa đủ để bảo mật tài liệu và chưa nên merge vào main
- `index.html` hiện chứa toàn bộ tài liệu tĩnh và nằm trên **repo public**; cổng login chỉ ẩn giao diện, người khác vẫn xem được source. Để nội dung thật sự cần mật khẩu, phải tách toàn bộ tài liệu khỏi HTML công khai, lưu trong DB với RLS authenticated, tải sau đăng nhập. Lịch sử git public vẫn có nội dung cũ.
- Khách có thể chỉnh sửa bản sao local trên trình duyệt dù UI đã ẩn nút; điều quan trọng là máy chủ không chấp nhận ghi khi không phải admin. Nhưng UI hiện chưa chuyển toàn bộ thao tác lưu trực tiếp sang server, vì vậy tính năng đồng bộ tự động đa thiết bị **chưa hoàn chỉnh**.
- Đồng bộ snapshot hiện ở dạng **thủ công**. Dữ liệu/ảnh lớn có thể vượt giới hạn bảng JSON/đường truyền; cần Storage + kiểm thử trước khi chuyển dữ liệu.
- Chưa kiểm thử trên GitHub Pages và Supabase production.
- Không merge PR khi chưa xong migration, kiểm thử an toàn và xác nhận dữ liệu đã backup.

## Sơ đồ quyền
- Admin: đăng nhập email/mật khẩu riêng, UID thuộc allowlist `private.kim_flora_admins`.
- Guest: mỗi khách có email riêng được invite; đặt mật khẩu qua email, đọc/tìm kiếm; RLS chặn mọi ghi.
- Không đăng nhập: không có quyền đọc DB.
