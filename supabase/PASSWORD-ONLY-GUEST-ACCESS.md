# Kim Flora — khách đăng nhập chỉ bằng mật khẩu (yêu cầu đã xác nhận)

## Trải nghiệm
- Khách mở URL website, thấy một ô **Mật khẩu truy cập**, không phải nhập email hay đăng ký.
- Chủ sở hữu phát riêng cho mỗi khách một mã/mật khẩu riêng. Khách nhập mật khẩu để xem và tìm kiếm, không được sửa.
- Chủ sở hữu dùng đăng nhập Admin riêng qua Supabase Auth; được quản lý khách, thêm mã, thu hồi mã và chỉnh sửa nội dung.
- Một mật khẩu khách phải gắn với một bản ghi cụ thể để có thể thu hồi riêng từng khách mà không ảnh hưởng khách khác.

## Yêu cầu bảo mật thực thi ở máy chủ
- Không nhúng mật khẩu khách, danh sách mật khẩu, hoặc password hash vào HTML/JavaScript hay repository công khai.
- Không xác thực bằng so sánh mật khẩu trên frontend.
- Lưu mật khẩu ở server dưới dạng băm có salt với Argon2id (hoặc thuật toán password hashing phù hợp), giới hạn số lần thử, ghi nhật ký truy cập và cấp phiên ngắn hạn qua cookie Secure HttpOnly SameSite (trên server phù hợp) hoặc giải pháp session token tương đương, hạn chế rò rỉ.
- Server API kiểm tra phiên và quyền với mỗi lần đọc nội dung; thao tác ghi phải xác thực Admin riêng và RLS.
- Chuyển nội dung học và ảnh cần bảo vệ ra khỏi HTML GitHub Pages public, tải nội dung qua API sau xác thực. Repo public và lịch sử git hiện chứa HTML nên chưa bảo mật nội dung cũ.
- Quản trị viên chỉ nên tạo/thu hồi mật khẩu khách qua endpoint yêu cầu Admin JWT; không đưa Supabase service_role key ra frontend.

## Trạng thái
- Đây là yêu cầu mới thay thế mô hình khách đăng nhập bằng email trong bản thử nghiệm.
- Đã loại bỏ nút gửi email mời khách khỏi giao diện thử nghiệm.
- Chưa có endpoint mật khẩu khách hoạt động, chưa có bộ quản lý mật khẩu hoặc di chuyển nội dung khỏi file HTML.
- **KHÔNG merge nhánh thử nghiệm vào main lúc này.** Bản thử nghiệm còn chứa login email cho khách và chưa đáp ứng yêu cầu này.
