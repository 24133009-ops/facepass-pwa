# 📋 Kế Hoạch Dự Án FacePass PWA (PROJECT PLAN)

> **Hệ thống Điểm danh Lớp học Bằng Nhận diện Khuôn mặt (AWS Serverless & React PWA)**  
> **Khu vực triển khai:** `ap-southeast-1` (Singapore)  
> **Runtime:** Python 3.12 (AWS Lambda) | React 18 + TypeScript + Vite + Tailwind CSS (PWA)

---

## 🏛️ 1. Tổng Quan Kiến Trúc Hệ Thống (Architecture)

FacePass PWA được thiết kế theo mô hình **Cloud-Native Serverless** kết hợp với ứng dụng **Progressive Web App (PWA)** di động, tối ưu hóa chi phí vận hành ở mức thấp nhất (Zero-Idle Cost) và đảm bảo an toàn bảo mật dữ liệu sinh trắc học:

```
[ Điện Thoại Giảng Viên / PWA (React 18 + TS) ]
                      │
           HTTPS (CloudFront CDN)
                      │
   ┌──────────────────┴──────────────────┐
   ▼                                     ▼
[ S3 Frontend Bucket ]          [ HTTP API Gateway v2 ]
(Static PWA Build)              (Cognito JWT Authorizer & Strict CORS)
                                         │
        ┌────────────────────────────────┼────────────────────────────────┐
        ▼                                ▼                                ▼
[ Classes Function ]            [ Students Function ]            [ Enrollment Function ]
- CRUD Lớp học                   - Thêm/Xóa SV, Import CSV        - Presigned POST (<=5MB)
- Rekognition Collection         - GDPR DeleteFaces               - IndexFaces, Purge S3 Raw
        │                                │                                │
        └────────────────────────────────┼────────────────────────────────┘
                                         ▼
                             [ Attendance Function ]
                             - Layer Pillow (+20% Crop)
                             - Multi-Face Search
                             - Phân nhóm & Chặn Confirm nếu còn Uncertain
                             - Gmail SMTP Email cảnh báo vắng (SSM Parameter Store)
                                         │
     ┌──────────────────┬────────────────┴─────────────────┬──────────────────┐
     ▼                  ▼                                  ▼                  ▼
[ DynamoDB ]      [ S3 Photos ]                   [ Rekognition ]       [ Gmail SMTP ]
- Classes         - Presigned POST                - Collections         - Cảnh báo vắng
- Students        - Purge Raw in Finally          - DetectFaces         - Cá nhân hóa
- Sessions        - Lifecycle 1-day               - SearchFaces         - Chống gửi trùng
- Attendance
```

### Chi tiết các tầng thành phần:
1. **Frontend (PWA):**
   - Single Page Application xây dựng trên React 18, Vite, TypeScript, Tailwind CSS.
   - Cấu hình PWA (Service Worker) hỗ trợ cài đặt lên màn hình chính điện thoại, hoạt động mượt mà.
   - **Chính sách Cache:** Tuyệt đối không cache các request API (`/api/*`) và ảnh sinh trắc học để đảm bảo tính thời gian thực và riêng tư.
   - **Bảo mật Token:** Lưu trữ JWT Token trong Bộ nhớ RAM (React State/Context), tuyệt đối không lưu vào `localStorage` hay `sessionStorage` để triệt tiêu lỗ hổng đánh cắp token qua XSS.
   - **Mock API Mode:** Điều khiển bằng biến môi trường `VITE_USE_MOCK` (`true` ở môi trường dev local, `false` ở môi trường production).
   - **Giao diện:** Thiết kế theo triết lý Mobile-First, nút bấm kích thước lớn (chiều cao tối thiểu 48px), thao tác một tay tiện lợi trong môi trường giảng đường.

2. **Backend API & Compute (AWS Lambda & HTTP API Gateway):**
   - HTTP API Gateway v2 tích hợp **Cognito JWT Authorizer** bảo vệ toàn bộ các endpoint nghiệp vụ.
   - **CORS chặt chẽ:** Chỉ cho phép domain của CloudFront và `http://localhost:5173`, không dùng wildcard `*`.
   - 4 Lambda Functions viết bằng Python 3.12:
     - `ClassesFunction`: Quản lý danh mục lớp học và Rekognition Collection theo từng lớp.
     - `StudentsFunction`: Quản lý danh sách sinh viên, nhập CSV, xóa sinh viên (kèm xóa vector nhận diện).
     - `EnrollmentFunction`: Cấp URL upload ảnh khuôn mặt có chữ ký (Presigned POST), kiểm tra chất lượng ảnh, trích xuất đặc trưng và lập tức xóa ảnh gốc.
     - `AttendanceFunction`: Cấp URL upload ảnh tập thể, cắt khuôn mặt qua `PillowLayer`, đối soát nhận diện, xử lý phân loại điểm danh, kích hoạt gửi mail Gmail SMTP và xuất báo cáo CSV.
   - Phân quyền IAM tuân thủ nguyên tắc đặc quyền tối thiểu (Least Privilege).

3. **Dữ liệu, Nhận diện & Gửi Email (DynamoDB, S3, Rekognition, Gmail SMTP / SSM):**
   - **DynamoDB:** Chế độ On-Demand (PAY_PER_REQUEST), gồm 4 bảng: `facepass-classes`, `facepass-students`, `facepass-sessions`, `facepass-attendance`.
   - **S3 Photo Bucket:** Private, mã hóa SSE-S3 AES-256, áp dụng Lifecycle tự động xóa ảnh sau 1 ngày, Presigned POST kiểm soát kích thước 1KB - 5MB và Content-Type `image/jpeg`.
   - **Amazon Rekognition:** Phân tách Collection riêng biệt theo từng lớp (`facepass-<classId>`). Đối soát khuôn mặt đa đối tượng bằng phương pháp DetectFaces + Cắt từng khuôn mặt có đệm 20% (+20% padding) + SearchFacesByImage.
   - **Gửi Email Cảnh Báo Vắng (Phương án C - Gmail SMTP via SSM):** Tái sử dụng một kết nối TLS tới `smtp.gmail.com:587` cho toàn bộ danh sách sinh viên vắng trong lớp. Thông tin tài khoản và App Password được lưu trữ bảo mật trong AWS SSM Parameter Store (`SecureString`, mã hóa AWS KMS), Lambda đọc một lần khi cold-start (không có secret trong mã nguồn, git hay console log).
   - **AWS Budgets:** Thiết lập cảnh báo chi phí định kỳ tại ngưỡng 80% của ngân sách $5 USD/tháng.

---

## 🔢 2. Danh Sách Task 1-12 và Trạng Thái Triển Khai

| Task | Tên Nhiệm Vụ & Nội Dung Chi Tiết | Trạng Thái |
| :--- | :--- | :---: |
| **Task 1** | **Thiết kế Kiến trúc AWS Serverless, SAM Template & Quản trị Chi phí**<br>• Xây dựng file SAM `backend/template.yaml` chuẩn hóa toàn bộ hạ tầng.<br>• Khai báo Cognito, DynamoDB (4 bảng), S3 (Photos & Frontend), HTTP API, CloudFront, Lambda Functions.<br>• Thiết lập AWS Budget cảnh báo ngưỡng 80% của $5 USD/tháng.<br>• Kiểm tra tính hợp lệ qua `sam validate --lint`. | **HOÀN THÀNH** |
| **Task 2** | **Cấu hình Xác thực Giảng viên (Cognito User Pool & Khóa chặt CORS)**<br>• Cấu hình Cognito User Pool chỉ cho phép Admin tạo tài khoản (không cho tự đăng ký).<br>• Thiết lập App Client không secret, hỗ trợ luồng xác thực SRP / Password.<br>• Cấu hình HTTP API Cognito JWT Authorizer.<br>• Khóa chặt cấu hình CORS API Gateway và S3 vào domain cụ thể (CloudFront & localhost).<br>• Xây dựng module `auth.py` trích xuất `teacherId` và kiểm soát phân quyền sở hữu lớp (403 Forbidden). | **HOÀN THÀNH** |
| **Task 3** | **Quản trị Lớp học và Sinh viên (Classes & Students Handlers, GDPR Delete)**<br>• `classes_handler.py`: Tạo lớp học, liệt kê lớp thuộc quyền giảng viên, tự động khởi tạo Rekognition Collection `facepass-<classId>`.<br>• `students_handler.py`: Xem danh sách sinh viên, thêm sinh viên đơn lẻ, import danh sách hàng loạt từ CSV.<br>• Triển khai quyền được lãng quên (GDPR Right to Erasure): Khi xóa sinh viên, gọi `DeleteFaces` để xóa sạch toàn bộ vector sinh trắc học khỏi Rekognition Collection trước khi xóa bản ghi DynamoDB. | **HOÀN THÀNH** |
| **Task 4** | **Đăng ký Khuôn mặt Sinh viên (Biometric Enrollment & Quyền Riêng Tư Dữ Liệu)**<br>• `enrollment_handler.py`: Cấp Presigned POST S3 giới hạn dung lượng 1KB - 5MB và `image/jpeg` thuộc prefix an toàn `enrollments/{teacher}/{class}/`.<br>• Kiểm tra xác thực cam kết đồng ý thu thập sinh trắc học (Consent Checkbox & Timestamp).<br>• Kiểm tra chất lượng ảnh khuôn mặt: độ sáng >= 30, độ nét >= 30, chính xác 1 khuôn mặt.<br>• Trích xuất vector qua `IndexFaces`.<br>• **Bảo vệ quyền riêng tư tuyệt đối:** Xóa vĩnh viễn ảnh raw khỏi S3 ngay lập tức trong khối `finally` (ngay cả khi kiểm tra chất lượng thất bại). | **HOÀN THÀNH** |
| **Task 5** | **Điểm danh Toàn cảnh Lớp học, Review Thủ công, Cảnh báo Email & Xuất CSV**<br>• `attendance_handler.py`: Cấp Presigned POST upload ảnh lớp học (<=5MB).<br>• Cắt từng khuôn mặt bằng Pillow Layer với đệm 20% (+20% padding) và đối soát `SearchFacesByImage` với ngưỡng 80%.<br>• Tự động phân loại: Có mặt (>=90%), Cần xác nhận (80-89.9%), Vắng mặt (chưa nhận diện).<br>• **Quy tắc bắt buộc:** Chặn xác nhận điểm danh (400) nếu vẫn còn sinh viên trong nhóm "Cần xác nhận".<br>• Cơ chế chống gửi email trùng lặp dựa trên cờ `emailsSentAt` và khóa điều kiện DynamoDB `ConditionExpression`.<br>• Gửi email cảnh báo vắng học lịch sự qua Gmail SMTP (SSM Parameter Store) tới từng cá nhân.<br>• Xuất dữ liệu điểm danh ra định dạng CSV.<br>• Bộ unit test 38/38 pass 100% và đã commit vào repository. | **HOÀN THÀNH** |
| **Task 6** | **Khởi tạo Frontend React 18 PWA (Vite, TypeScript, Tailwind, Service Worker)**<br>• Cấu trúc thư mục frontend React 18 + Vite + TypeScript + Tailwind CSS.<br>• Tích hợp plugin `vite-plugin-pwa` với manifest PWA hoàn chỉnh.<br>• Cấu hình chiến lược Cache Service Worker: **Tuyệt đối không cache các request `/api/*` và hình ảnh sinh trắc học**.<br>• Thiết lập giao diện Mobile-First, nút bấm to rõ (tối thiểu 48px), thanh điều hướng tiện dụng. | **HOÀN THÀNH** |
| **Task 7** | **Giao diện Đăng nhập Giảng viên & Quản trị Xác thực Bảo mật**<br>• Màn hình đăng nhập tối ưu trên điện thoại.<br>• Xử lý triệt để luồng mật khẩu tạm thời `NEW_PASSWORD_REQUIRED` từ Cognito Admin kèm form đổi mật khẩu và checklist an toàn.<br>• Quản trị Access/ID Token an toàn trong **Memory State** (Tuyệt đối không lưu vào `localStorage` / `sessionStorage`).<br>• Tích hợp Mock Authentication cho môi trường dev local và luồng Đăng xuất an toàn. | **HOÀN THÀNH** |
| **Task 8** | **Hệ thống Mock API & Giao diện Quản lý Lớp học / Sinh viên**<br>• Triển khai cơ chế Mock API toàn diện kích hoạt qua cờ `VITE_USE_MOCK` (true khi dev, false khi build prod).<br>• Màn hình danh sách lớp học và modal tạo mới lớp học.<br>• Màn hình danh sách sinh viên: hiển thị trạng thái đã đăng ký khuôn mặt, thêm sinh viên lẻ.<br>• Tính năng import danh sách sinh viên từ file CSV (có hỗ trợ upload file và mẫu demo).<br>• Tính năng xóa sinh viên kèm modal cảnh báo xóa dữ liệu nhận diện GDPR. | **HOÀN THÀNH** |
| **Task 9** | **Module Đăng ký Khuôn mặt Sinh viên trên PWA (Camera & Biometric Consent)**<br>• Checkbox cam kết đồng ý thu thập sinh trắc học (đủ 18 tuổi, đồng ý lưu đặc trưng khuôn mặt, có thể yêu cầu xóa); khóa nút chụp nếu chưa tick.<br>• Chụp 2-3 ảnh để tối ưu độ chính xác.<br>• Ưu tiên camera trước qua `getUserMedia`, fallback thẻ `<input type="file" accept="image/*" capture="user">`.<br>• Xử lý thông minh khi người dùng từ chối cấp quyền camera.<br>• Nén ảnh cạnh dài tối đa 1280px (JPEG) phía client.<br>• Upload ảnh bằng `FormData` theo chuẩn Presigned POST (các field server trước, `file` cuối cùng).<br>• Hoàn tất đăng ký khuôn mặt vào Rekognition Collection.<br>• Tuyệt đối không log ảnh khuôn mặt hoặc tên sinh viên ra console.log. | **HOÀN THÀNH** |
| **Task 10** | **Module Điểm danh Toàn cảnh & Đối soát Nhận diện AI**<br>• Giao diện chụp ảnh góc rộng toàn cảnh lớp học (ưu tiên camera sau qua `getUserMedia`, fallback input capture).<br>• Nén ảnh cạnh dài tối đa 1280px (JPEG), upload Presigned POST và kích hoạt quét AI.<br>• Màn hình đối soát 3 nhóm trực quan (Có mặt / Cần xác nhận / Vắng) và khuôn mặt lạ ngoài danh sách.<br>• Thao tác một chạm chuyển đổi trạng thái sinh viên giữa các nhóm.<br>• Nút "Xác nhận & gửi thông báo" bị khóa cho đến khi nhóm "Cần xác nhận" được phân loại hết (uncertainCount = 0).<br>• Hộp thoại xác nhận trước khi chốt buổi học và gửi thông báo.<br>• Tuyệt đối không log ảnh khuôn mặt hoặc tên sinh viên ra console.log. | **HOÀN THÀNH** |
| **Task 11** | **Xác nhận Điểm danh, Lịch Sử Buổi Học, Trạng Thái Gửi Mail & Xuất CSV**<br>• Trang lịch sử các buổi điểm danh theo lớp (sĩ số, số có mặt, số vắng mặt, trạng thái gửi mail).<br>• Lưu trạng thái gửi mail chi tiết cho từng sinh viên (`sent`/`failed`, lý do lỗi, thời điểm) trong DynamoDB và Mock.<br>• Không dùng nhãn "đã gửi" khi chưa có xác nhận từ nhà cung cấp email.<br>• Nút "Gửi lại" (Retry) trực tiếp trong modal chi tiết buổi học cho các sinh viên gửi mail thất bại.<br>• Kiểm tra định dạng email khi thêm sinh viên và nhập file CSV (cảnh báo chi tiết từng dòng lỗi kèm số dòng).<br>• Modal xem chi tiết danh sách từng buổi học kèm độ tương đồng AI.<br>• Xuất báo cáo CSV đạt chuẩn quốc tế: **BOM UTF-8 (`\uFEFF`)** hiển thị tiếng Việt chuẩn trên Excel.<br>• **Chống CSV Injection (Formula Injection)**: Tự động phát hiện và thêm tiền tố nháy đơn `'` cho các ô bắt đầu bằng `=`, `+`, `-`, `@`, `\t`, `\r`, `\n`. | **HOÀN THÀNH** |
| **Task 12** | **Kiểm thử Toàn diện E2E, Tối ưu PWA & Đóng gói Triển khai Production**<br>• Kiểm thử luồng nghiệp vụ liên hoàn từ Đăng nhập -> Quản lý lớp -> Đăng ký -> Điểm danh -> Báo cáo.<br>• Kiểm tra tính năng PWA cài đặt trên thiết bị di động thật (iOS Safari / Android Chrome).<br>• Chạy quy trình build production tĩnh (`npm run build` trong `frontend/`) pass 100%.<br>• Bộ unit test 38/38 pass 100%.<br>• Hoàn thiện bộ tài liệu hướng dẫn vận hành, quy trình deploy production 1 lượt tự động chuẩn hóa CORS cho PowerShell Windows và quy trình dọn dẹp sạch tài nguyên (sam delete). | **HOÀN THÀNH** |

---

## ⚠️ 3. Các Quy Tắc Bắt Buộc Của Dự Án (Mandatory Rules & Constraints)

Trong toàn bộ quá trình phát triển dự án, các nguyên tắc sau đây là **bắt buộc tuân thủ tuyệt đối**:

1. 🚫 **Không deploy (No Deployment):**
   - Tuyệt đối không tự ý chạy các lệnh `sam deploy`, `aws cloudformation deploy` hoặc đẩy ứng dụng lên hạ tầng Cloud thật nếu chưa có yêu cầu và xác nhận từ người dùng.

2. 🚫 **Không chạy lệnh AWS thật (No Live AWS CLI Commands):**
   - Không thực thi bất kỳ lệnh AWS CLI nào tương tác với dịch vụ thật (`aws s3`, `aws dynamodb`, `aws rekognition`, ...) để tránh phát sinh chi phí hoặc rủi ro sai lệch dữ liệu.

3. ✋ **Hỏi trước mỗi lệnh terminal (Ask Before Every Terminal Command):**
   - Trước khi thực thi bất kỳ câu lệnh nào trong terminal/shell (`run_command`), bắt buộc phải dừng lại, trình bày rõ lệnh dự kiến thực hiện và mục đích, chờ sự đồng ý từ người dùng trước khi chạy.

4. 📁 **Chỉ đọc/ghi trong thư mục dự án (Strictly Scoped File Operations):**
   - Mọi thao tác đọc file, tạo file, chỉnh sửa mã nguồn chỉ được phép diễn ra bên trong thư mục gốc của dự án (`C:\dev\facepass-pwa`). Tuyệt đối không can thiệp, tạo file hoặc chạy lệnh ngoài phạm vi này.
   - **Lưu ý cấu trúc thư mục mới:** Mọi mã nguồn Frontend nằm tại `frontend/`. Toàn bộ các lệnh `npm` (`npm install`, `npm run build`, `npm run dev`) bắt buộc phải chạy từ thư mục `frontend/`.

5. 🛡️ **Bảo mật Token - Không lưu trong LocalStorage (Zero LocalStorage for Auth Tokens):**
   - Access Token và ID Token của giảng viên chỉ được lưu tạm trong bộ nhớ (In-Memory State / React Context). Tuyệt đối không lưu vào `localStorage` hay `sessionStorage` nhằm triệt tiêu nguy cơ bị đánh cắp danh tính qua các cuộc tấn công XSS.

6. ⚡ **Chính sách Cache Service Worker (No API/Image Caching):**
   - Cấu hình Service Worker PWA tuyệt đối không cache các request API `/api/*` và các URL ảnh S3 để đảm bảo tính chính xác tức thời và tuân thủ quyền riêng tư dữ liệu sinh trắc học.

7. 🔄 **Cờ chuyển đổi Mock API (`VITE_USE_MOCK`):**
   - Biến môi trường `VITE_USE_MOCK=true` ở chế độ phát triển local (`frontend/.env.development`) để chạy giả lập không phụ thuộc backend AWS.
   - Biến môi trường `VITE_USE_MOCK=false` ở chế độ production (`frontend/.env.production`) để kết nối API Gateway thật sau khi triển khai.

8. 🔒 **Bảo vệ Dữ liệu Sinh trắc học & Quyền riêng tư (Privacy-by-Design):**
   - Luôn yêu cầu sinh viên tích chọn đồng ý cung cấp dữ liệu sinh trắc học (Consent Agreement: Đủ 18 tuổi, đồng ý lưu đặc trưng khuôn mặt, có quyền yêu cầu xóa).
   - Ảnh khuôn mặt thô (raw photo) phải được xóa vĩnh viễn khỏi S3 ngay sau khi trích xuất vector đặc trưng khuôn mặt (trong khối `finally`).
   - Khi xóa sinh viên, bắt buộc phải gọi xóa vector khuôn mặt tương ứng trong Amazon Rekognition (`DeleteFaces`) để tuân thủ quyền được lãng quên (GDPR).
   - **Tuyệt đối không đưa ảnh khuôn mặt (base64/blob) hay tên sinh viên vào `console.log`** trong toàn bộ mã nguồn frontend và backend để bảo vệ quyền riêng tư người dùng.

---

## 📌 4. Việc Sau Khi Deploy Chạy Ổn (Post-Deployment Backlog)

Các hạng mục cải tiến kỹ thuật được lên kế hoạch triển khai sau khi hoàn tất nghiệm thu hệ thống cơ sở:
1. **Kết nối lại SMTP tự động (Auto-Reconnect):** Thiết lập cơ chế tự động mở lại kết nối SMTP một lần nếu phiên kết nối hiện tại bị ngắt giữa chừng trong lúc duyệt danh sách sinh viên vắng.
2. **Bộ lọc & Dashboard CloudWatch Insights:** Tối ưu hóa truy vấn logs trên CloudWatch Insights dựa trên format JSON chuẩn (`event`, `awsErrorCode`, `origin`).
3. **Phát hiện sự sống (Face Liveness Detection):** Tích hợp AWS Rekognition Face Liveness hoặc Challenge-Response chống điểm danh giả mạo bằng ảnh in hoặc video.
4. **Kiểm chứng và tinh chỉnh độ chính xác trên lớp học thật:** Chụp thử nghiệm trong điều kiện ánh sáng giảng đường thực tế để kiểm tra và tinh chỉnh ngưỡng nhận diện 90/80%.

---

## 🤖 5. Quy Tắc Làm Việc Với AI Agent (Pair Programming Protocols)

Để đảm bảo an toàn tuyệt đối và tính trung thực kỹ thuật khi phối hợp giữa Người dùng và AI Agent:

1. **Không tin báo cáo chưa có output thật:** Chỉ chấp nhận kết quả từ các câu lệnh terminal đã thực sự chạy trong phiên hiện tại, kèm nguyên văn output (stdout/stderr) và exit code thực tế; tuyệt đối không suy đoán, tóm tắt hay bịa đặt kết quả.
2. **Không bao giờ nhận hay ghi App Password hoặc Access Key:** Tuyệt đối không hỏi, không nhận, không log và không ghi bất kỳ secret nào (Gmail App Password, AWS Access Key, Private Key) vào chat, file cấu hình, mã nguồn hay lịch sử terminal. Nếu phát hiện chuỗi giống khóa, Agent phải dừng lại và cảnh báo ngay lập tức.
3. **Không chạy `sam deploy` hay lệnh AWS tạo tài nguyên:** Agent tuyệt đối không tự ý thực thi các lệnh deploy hay các lệnh CLI làm thay đổi hạ tầng trên Cloud thật. Việc deploy thực tế phải do người dùng tự thực thi trực tiếp trên máy của mình.
4. **Chỉ làm trong thư mục dự án (`C:\dev\facepass-pwa`):** Mọi thao tác đọc file, ghi file, chỉnh sửa mã nguồn và chạy lệnh chỉ được phép diễn ra trong thư mục dự án. Tuyệt đối không mở, đọc hoặc sửa bất kỳ file nào ngoài phạm vi này (kể cả file transcript logs hệ thống).
5. **Hỏi trước mỗi lệnh terminal:** Trước khi thực thi bất kỳ câu lệnh nào qua terminal/shell (`run_command`), Agent bắt buộc phải dừng lại, xin phép người dùng và chỉ chạy khi được người dùng đồng ý rõ ràng.
6. **Không sửa test cho khớp output:** Khi test thất bại, nguyên nhân phải được tìm ra và khắc phục ở hành vi của mã nguồn ứng dụng (logic code); tuyệt đối không sửa đổi assertion của test để làm cho test pass một cách giả tạo.
