# 📱 FacePass PWA - Hệ Thống Điểm Danh Lớp Học Bằng Nhận Diện Khuôn Mặt (AWS Serverless)

Ứng dụng Progressive Web App (PWA) di động hỗ trợ Giảng viên điểm danh sinh viên bằng nhận diện khuôn mặt đa đối tượng trên ảnh tập thể góc rộng, tích hợp cảnh báo vắng học tự động qua **SMTP Gmail** với thông tin xác thực lưu trữ bảo mật trong **AWS Systems Manager (SSM) Parameter Store (SecureString)**.

- **Khu vực triển khai (Region):** `us-east-1` (N. Virginia)
- **Kiến trúc Serverless:** AWS SAM, HTTP API Gateway v2, Lambda (Python 3.12), Amazon Rekognition, DynamoDB (On-Demand), S3 (SSE-S3 AES-256), Amazon Cognito User Pool, CloudFront CDN, SSM Parameter Store (Gmail SMTP), React 18, Vite, TypeScript, Tailwind CSS, PWA Service Worker.

---

## 📁 Cấu Trúc Dự Án (Project Structure)

```text
facepass-pwa/
├── backend/            # AWS SAM Serverless Backend (Python 3.12)
│   ├── src/            # Lambda handlers (classes, students, enrollment, attendance) & common libs
│   ├── tests/          # Bộ kiểm thử tự động toàn diện (58/58 tests pass 100%)
│   ├── layers/         # Pillow Lambda Layer cho xử lý cắt ảnh khuôn mặt đa đối tượng
│   └── template.yaml   # AWS SAM CloudFormation Infrastructure Template
├── frontend/           # PWA Di Động (React 18 + Vite + TypeScript + Tailwind CSS)
│   ├── src/            # Components, Context, Pages, Mock API, Services
│   ├── public/         # PWA Manifest, favicon, icons
│   ├── package.json    # Mọi thao tác npm chạy trực tiếp trong frontend/
│   ├── vite.config.ts  # Cấu hình Vite PWA (NetworkOnly bypass cho /api và ảnh)
│   ├── .env.development# VITE_USE_MOCK=true (chế độ phát triển local)
│   └── .env.production # VITE_USE_MOCK=false (chế độ production mẫu)
└── docs/               # Kế hoạch dự án, kiến trúc và quy chuẩn phát triển (PROJECT_PLAN.md)
```

> **Lưu ý quan trọng về lệnh thực thi:**
> - Mọi thao tác npm (`npm install`, `npm ci`, `npm run dev`, `npm run build`) được thực thi bên trong thư mục `frontend/`.
> - Mọi thao tác SAM CLI (`sam build`, `sam validate`) và unit test backend được thực thi trong thư mục `backend/` hoặc từ thư mục gốc có chỉ định đường dẫn.

---

## 🛠️ Chuẩn Bị Trước Khi Deploy (Chạy Trên AWS Academy Sandbox)

Trước khi thực hiện lệnh deploy, bạn cần tự chuẩn bị tài khoản và môi trường trên máy tính và trên AWS Management Console theo các bước sau:

### 1. Tài Khoản Gmail Riêng Cho Ứng Dụng & App Password
Để Lambda gửi email cảnh báo vắng qua SMTP Gmail an toàn mà không chứa bất kỳ secret nào trong mã nguồn, bạn cần tạo 2 tham số `SecureString` trên **AWS Systems Manager (SSM) Parameter Store**:
- **Tài khoản Gmail riêng:** Tuyệt đối không dùng tài khoản Gmail cá nhân chính chứa dữ liệu nhạy cảm. Hãy tạo một tài khoản Gmail riêng cho ứng dụng.
- **Bật Xác minh 2 bước:** Truy cập Google Account -> mục **Bảo mật (Security)** -> bật **Xác minh 2 bước (2-Step Verification)**.
- **Tạo App Password:** Vào mục **Mật khẩu ứng dụng (App passwords)** -> Tạo mật khẩu ứng dụng mới cho FacePass (chuỗi 16 ký tự).
- **Lưu vào Parameter Store Console (Vùng N. Virginia - `us-east-1`):**
  > ⚠️ **LƯU Ý QUAN TRỌNG:** Hãy chắc chắn bạn đã chọn đúng vùng **N. Virginia (`us-east-1`)** ở thanh điều hướng trên cùng của AWS Management Console trước khi tạo tham số.
  - Tìm dịch vụ **Systems Manager** -> chọn mục **Parameter Store** (menu bên trái).
  - Tạo 2 tham số với Tier **Standard**, Type **`SecureString`** (KMS key: `alias/aws/ssm`):
    1. **Tham số 1:** Name: `/facepass/gmail/username` | Value: Địa chỉ Gmail của bạn (ví dụ: `teacher.facepass@gmail.com`).
    2. **Tham số 2:** Name: `/facepass/gmail/app_password` | Value: Dán trực tiếp chuỗi 16 ký tự App Password vừa tạo (viết liền không khoảng trắng).
  - **Nguyên tắc bảo mật:** Dán mật khẩu trực tiếp vào AWS Console; không gõ mật khẩu vào terminal, không lưu vào bất kỳ file nào trong dự án, và tuyệt đối không dán mật khẩu vào chat.

### 2. Thiết Lập Môi Trường AWS Academy Sandbox (Thông Tin Xác Thực Tạm Thời)
- **Vùng hoạt động cố định:** AWS Academy Learner Lab hoạt động cố định tại vùng **`us-east-1` (N. Virginia)**.
- **Khởi động Lab:** Trong giao diện AWS Academy, bấm nút **Start Lab** và chờ đến khi biểu tượng trạng thái chuyển sang màu xanh (Ready).
- **Lấy thông tin xác thực AWS CLI:**
  1. Bấm vào nút **AWS Details** ở phía trên giao diện Lab.
  2. Tại dòng **AWS CLI**, bấm **Show** để hiển thị cấu hình credentials tạm thời (gồm `aws_access_key_id`, `aws_secret_access_key`, và `aws_session_token`).
  3. Sao chép và dán cấu hình này vào file `~/.aws/credentials` trên máy của bạn (dưới profile `[default]` hoặc profile riêng `[facepass]`), hoặc gán trực tiếp vào biến môi trường PowerShell:
     ```powershell
     $env:AWS_ACCESS_KEY_ID = "<Dán aws_access_key_id>"
     $env:AWS_SECRET_ACCESS_KEY = "<Dán aws_secret_access_key>"
     $env:AWS_SESSION_TOKEN = "<Dán aws_session_token>"
     $env:AWS_DEFAULT_REGION = "us-east-1"
     ```
- **Thời hạn khóa tạm thời (180 phút):** Khóa xác thực tạm thời của AWS Academy có hiệu lực tối đa **180 phút (3 giờ)**. Khi hết thời gian phiên làm việc hoặc mỗi lần Start Lab lại, bạn cần lấy bộ khóa tạm mới từ "AWS Details" và cập nhật lại CLI.
- **Quy tắc an toàn bảo mật:** Tuyệt đối **không dán Access Key, Secret Key hay Session Token vào chat** và không commit bất kỳ thông tin nào vào repository.
- **Sử dụng IAM Role `LabRole`:** Môi trường AWS Academy Sandbox chặn toàn bộ quyền tạo mới IAM Role (`iam:CreateRole`). Toàn bộ 4 hàm Lambda trong backend đã được cấu hình trỏ thẳng tới Role có sẵn của Sandbox: `arn:aws:iam::${AWS::AccountId}:role/LabRole`.

### 3. Mở Docker Desktop & Kiểm Tra Daemon
Quá trình build thư viện xử lý ảnh `Pillow` cho Lambda bắt buộc phải biên dịch trong container Linux x86_64:
- Mở ứng dụng **Docker Desktop** trên Windows và chờ daemon khởi động hoàn tất.
- Kiểm tra trạng thái daemon bằng lệnh:
  ```powershell
  docker ps
  ```
  Nếu lệnh trả về danh sách container mà không báo lỗi kết nối daemon, Docker đã sẵn sàng.

### 4. Chạy Kịch Bản Kiểm Tra Toàn Diện Trước Khi Triển Khai (`preflight.ps1`)
Chạy kịch bản kiểm tra tự động ở chế độ CHỈ ĐỌC để rà soát toàn bộ công cụ, thẩm quyền IAM, tham số SSM, và an toàn mã nguồn:
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\preflight.ps1
```
*(Nếu muốn kiểm tra nhanh môi trường cục bộ mà chưa kết nối AWS, bạn có thể truyền thêm cờ `-SkipAws`).*

---

## 🏗️ 3. Build & Triển Khai Backend AWS SAM (MỘT Luồng Duy Nhất)

### Bước 3.1: Build Backend Bằng Container Linux
Lambda Function xử lý nhận diện khuôn mặt sử dụng thư viện C binary (`Pillow`). Trên máy tính Windows, **bắt buộc phải build bằng Docker container** để mã biên dịch tương thích 100% với môi trường Linux x86_64 của AWS Lambda:

1. Khởi động ứng dụng **Docker Desktop**.
2. Mở PowerShell tại thư mục dự án và chạy:
   ```powershell
   Set-Location -Path C:\dev\facepass-pwa\backend
   sam build --use-container
   ```

### Bước 3.2: Triển Khai Duy Nhất 1 Lượt Bằng `sam deploy --guided`
Trong `backend/template.yaml`, cấu hình CORS của `HttpApiGateway` đã trực tiếp liên kết tới domain của CloudFront Distribution trong cùng CloudFormation stack (`!Sub "https://${FrontendDistribution.DomainName}"`). Do đó **hoàn toàn không có vòng phụ thuộc** và hệ thống được triển khai trọn vẹn chỉ trong **1 lượt duy nhất**:

```powershell
sam deploy --guided
```

### Bảng Tham Số Tương Tác Khi Chạy `sam deploy --guided`:
Các tham số dưới đây được sinh trực tiếp từ khối `Parameters` thực tế trong `backend/template.yaml`:

| Tham Số / Câu Hỏi | Kiểu Dữ Liệu | Giá Trị Mặc Định | Ý Nghĩa Nghiệp Vụ & Giá Trị Gợi Ý |
| :--- | :---: | :---: | :--- |
| **Stack Name** | String | `facepass-pwa-prod` | Tên của CloudFormation Stack quản lý toàn bộ tài nguyên. Gợi ý: nhập `facepass-pwa-prod`. |
| **AWS Region** | String | `us-east-1` | Khu vực AWS đặt hạ tầng máy chủ. Gợi ý: nhập `us-east-1` (N. Virginia). |
| **Parameter Stage** | String (`[dev, staging, prod]`) | `prod` | Môi trường hệ thống. Gợi ý: chọn `prod`. |
| **Confirm changes before deploy** | Y/n | `Y` | Hiển thị bảng ChangeSet để bạn rà soát các tài nguyên trước khi tạo thật. Gợi ý: `Y`. |
| **Allow SAM CLI IAM role creation** | Y/n | `Y` | Cho phép SAM CLI quản lý role (mọi Lambda function đều dùng role LabRole có sẵn). Gợi ý: `Y`. |
| **Disable rollback** | y/N | `N` | Giữ nguyên cơ chế tự động hoàn tác (rollback) nếu có lỗi xảy ra trong quá trình deploy. Gợi ý: `N`. |
| **Save arguments to configuration file** | Y/n | `Y` | Lưu các tham số đã chọn vào file `samconfig.toml` cho các lần deploy sau. Gợi ý: `Y`. |
| **SAM configuration file** | String | `samconfig.toml` | Tên file lưu cấu hình. Gợi ý: nhấn **Enter** để nhận mặc định. |
| **SAM configuration environment** | String | `default` | Tên môi trường cấu hình. Gợi ý: nhấn **Enter** để nhận mặc định. |

#### Xử lý câu hỏi: `... may not have authorization defined, Is this okay? [y/N]`
SAM CLI kiểm tra tĩnh ở cấp từng event của Lambda Function. Trong `template.yaml`, `HttpApiGateway` đã thiết lập `DefaultAuthorizer: CognitoAuthorizer` ở cấp Gateway, nhưng kết luận bảo mật **phải dựa trên kiểm tra thực tế, không dựa trên lời giải thích hay giả định**. Bạn hãy nhập `y` để hoàn tất triển khai, và **bắt buộc phải thực hiện ngay Bước 3.4** bên dưới để kiểm chứng toàn bộ 14 tuyến route bằng lệnh gọi thực tế.

### Bước 3.3: Thu Thập Các Giá Trị Output Sau Khi Deploy
Sau khi lệnh deploy hoàn tất thành công, bảng `Outputs` của CloudFormation sẽ hiển thị:
- `ApiUrl`: Địa chỉ gốc của API Gateway (ví dụ: `https://a1b2c3d4.execute-api.us-east-1.amazonaws.com`).
- `UserPoolId`: ID của Cognito User Pool (ví dụ: `us-east-1_ABC123xyz`).
- `UserPoolClientId`: ID của Cognito App Client không dùng secret (ví dụ: `1a2b3c4d5e6f7g8h9i0j`).
- `FrontendBucketName`: Tên bucket S3 lưu trữ bản build giao diện (ví dụ: `facepass-frontend-123456789012-prod`).
- `DistributionId`: ID của CloudFront Distribution dùng để xóa cache (ví dụ: `E1A2B3C4D5E6F7`).
- `CloudFrontDomain`: Tên miền HTTPS truy cập ứng dụng (ví dụ: `d123456abcdef8.cloudfront.net`).

### Bước 3.4: Smoke Test Bắt Buộc - Kiểm Tra Toàn Bộ 14 Tuyến Route Không Có Token
Chạy khối lệnh sau trong PowerShell để kiểm tra toàn bộ 14 tuyến đường được khai báo trong template. **Tất cả 14 dòng bắt buộc phải trả về mã `401`**. Nếu có bất kỳ dòng nào ra mã khác (200, 404, 500...), script sẽ dừng lại và báo lỗi để kiểm tra ngay:

```powershell
$API_URL = "https://a1b2c3d4.execute-api.us-east-1.amazonaws.com" # Thay bằng ApiUrl của bạn
$routes = @(
  @("GET","/api/classes"), @("POST","/api/classes"), @("GET","/api/classes/cls-01"),
  @("GET","/api/classes/cls-01/students"), @("POST","/api/classes/cls-01/students"),
  @("DELETE","/api/classes/cls-01/students/sv-01"),
  @("GET","/api/classes/cls-01/students/sv-01/enrollment-url"),
  @("POST","/api/classes/cls-01/students/sv-01/enroll"),
  @("GET","/api/classes/cls-01/attendance/upload-url"),
  @("POST","/api/classes/cls-01/attendance/scan"),
  @("POST","/api/classes/cls-01/attendance/sess-01/confirm"),
  @("POST","/api/classes/cls-01/attendance/sess-01/retry-email"),
  @("GET","/api/classes/cls-01/attendance/sessions"),
  @("GET","/api/classes/cls-01/attendance/sess-01/export")
)

foreach ($r in $routes) {
  $code = curl.exe -s -o NUL -w "%{http_code}" -X $r[0] "$API_URL$($r[1])"
  "$($r[0]) $($r[1]) -> $code"
  if ($code -ne "401") {
    Write-Error "CẢNH BÁO BẢO MẬT: Tuyến $($r[0]) $($r[1]) trả về $code (không phải 401)! Dừng lại ngay để kiểm tra."
    break
  }
}
```
> **Kết quả mong đợi:** Cả 14 dòng đều in ra `-> 401`. Điều này chứng minh 100% các endpoint nghiệp vụ đã được khóa chặt bởi Cognito JWT Authorizer.

---

## 👤 4. Khởi Tạo Tài Khoản Giảng Viên Trong Cognito User Pool (Console)

Để đảm bảo tính bảo mật và kiểm soát truy cập, Cognito User Pool được cấu hình chặn tự do đăng ký:

> ⚠️ **LƯU Ý:** Đảm bảo bạn đang ở Region **N. Virginia (`us-east-1`)** trên AWS Console.

1. Vào AWS Console -> chọn dịch vụ **Amazon Cognito** -> chọn mục **User Pools**.
2. Nhấn chọn User Pool có tên `facepass-pwa-users-prod`.
3. Chuyển sang tab **Users** -> bấm nút **Create user**:
   - Chọn mục **Don't send an email invitation** (hoặc gửi thư mời).
   - **Email address:** Điền địa chỉ email của giảng viên (ví dụ: `giangvien@truong.edu.vn`).
   - Đánh dấu tick vào ô **Mark email address as verified**.
   - **Temporary password:** Tự nhập một mật khẩu tạm thời đủ mạnh (gồm tối thiểu 8 ký tự, có chữ hoa, chữ thường, chữ số và ký tự đặc biệt). Tuyệt đối không dùng lại các mật khẩu demo cố định.
4. Bấm **Create user**.
*(Khi giảng viên đăng nhập lần đầu bằng tài khoản này, giao diện PWA sẽ tự động nhận diện thử thách `NEW_PASSWORD_REQUIRED` và hiển thị form yêu cầu giảng viên đổi mật khẩu cá nhân mới).*

---

## 💻 5. Cấu Hình Biến Môi Trường Frontend & Build Bản Production

### Bước 5.1: Cấu hình file `.env.production.local`
Để bảo vệ an toàn thông tin và không lưu bất kỳ Resource ID thật nào vào git, bạn hãy tạo file `frontend/.env.production.local` (file này đã được khai báo trong `.gitignore` nên tuyệt đối không bị commit lên repository):

Chuyển vào thư mục frontend:
```powershell
Set-Location -Path C:\dev\facepass-pwa\frontend
```

Tạo file `.env.production.local` và điền các giá trị thực tế lấy từ Outputs ở Bước 3.3:
```ini
VITE_USE_MOCK=false
VITE_API_URL=https://a1b2c3d4.execute-api.us-east-1.amazonaws.com
VITE_COGNITO_REGION=us-east-1
VITE_COGNITO_CLIENT_ID=1a2b3c4d5e6f7g8h9i0j
```

> ⚠️ **Lưu ý kiểm tra tên file trên Windows:** Trình soạn thảo Notepad thường tự động thêm đuôi `.txt` thành `.env.production.local.txt`, khiến Vite không nhận diện được biến môi trường. Chạy lệnh sau trong PowerShell để kiểm tra chính xác:
> ```powershell
> Get-ChildItem -Force frontend\.env*
> ```
> Đảm bảo file có tên chính xác là `.env.production.local` (không có đuôi `.txt`).

### Bước 5.2: Cài Đặt Dependencies & Build Gói Tĩnh
Nếu thư mục `node_modules` chưa có hoặc cần cài đặt mới sạch sẽ, hãy chạy `npm ci` trước khi build:

```powershell
Set-Location -Path C:\dev\facepass-pwa\frontend

# Chạy npm ci nếu chưa có node_modules
if (-not (Test-Path node_modules)) { npm ci }

# Build gói tĩnh
npm run build
```
Lệnh sẽ biên dịch toàn bộ TypeScript, tối ưu hóa CSS, đóng gói Service Worker và xuất toàn bộ mã tĩnh vào thư mục `frontend/dist/`.

---

## ☁️ 6. Tải Lên S3, Invalidate Cache & Kiểm Tra Content-Type PWA

Sử dụng `FrontendBucketName` và `DistributionId` từ Outputs để đưa bản build mới nhất lên CDN:

```powershell
$FRONTEND_BUCKET = "facepass-frontend-123456789012-prod" # Thay bằng FrontendBucketName từ Outputs
$DISTRIBUTION_ID = "E1A2B3C4D5E6F7"                     # Thay bằng DistributionId từ Outputs
$CLOUDFRONT_DOMAIN = "d123456abcdef8.cloudfront.net"    # Thay bằng CloudFrontDomain từ Outputs

# 1. Đồng bộ toàn bộ nội dung thư mục dist/ lên S3 Frontend Bucket
aws s3 sync dist/ "s3://$FRONTEND_BUCKET" --delete --region us-east-1

# 2. Xóa cache CloudFront để người dùng nhận ngay bản cập nhật mới nhất
aws cloudfront create-invalidation --distribution-id "$DISTRIBUTION_ID" --paths "/*"
```

### Kiểm Tra Bắt Buộc: Content-Type Của Service Worker & Manifest
Trên Windows, AWS CLI đôi khi nhận diện sai extension và gán `Content-Type` là `text/plain` hoặc `application/octet-stream` cho file `.js` hoặc `.webmanifest`. Khi đó, trình duyệt sẽ chặn không cho đăng ký Service Worker và tính năng cài đặt PWA sẽ không hoạt động.

Chạy lệnh kiểm tra:
```powershell
curl.exe -sI "https://$CLOUDFRONT_DOMAIN/sw.js" | findstr /i content-type
curl.exe -sI "https://$CLOUDFRONT_DOMAIN/manifest.webmanifest" | findstr /i content-type
```

> **Kết quả yêu cầu:**
> - `sw.js` phải có Content-Type chứa `javascript` (ví dụ: `application/javascript` hoặc `text/javascript`).
> - `manifest.webmanifest` phải có Content-Type chứa `json` hoặc `manifest` (ví dụ: `application/manifest+json`).

**Nếu Content-Type bị sai (ví dụ text/plain), upload lại với cờ chỉ định rõ:**
```powershell
# Upload lại sw.js với Content-Type chuẩn
aws s3 cp dist/sw.js "s3://$FRONTEND_BUCKET/sw.js" --content-type "application/javascript" --region ap-southeast-1

# Upload lại manifest.webmanifest với Content-Type chuẩn
aws s3 cp dist/manifest.webmanifest "s3://$FRONTEND_BUCKET/manifest.webmanifest" --content-type "application/manifest+json" --region ap-southeast-1

# Xóa cache cho 2 file vừa sửa
aws cloudfront create-invalidation --distribution-id "$DISTRIBUTION_ID" --paths "/sw.js" "/manifest.webmanifest"
```

---

## 📜 7. Xem Logs Giám Sát & Xử Lý Sự Cố (Troubleshooting)

### Các Lệnh Xem Logs Realtime Bằng SAM CLI:
Mở một cửa sổ PowerShell mới tại thư mục `backend/` để theo dõi logs trực tiếp khi ứng dụng hoạt động:

```powershell
Set-Location -Path C:\dev\facepass-pwa\backend

# Xem logs của hàm Điểm danh & Gửi Mail
sam logs -n AttendanceFunction --stack-name facepass-pwa-prod --tail

# Xem logs của hàm Đăng ký sinh trắc học
sam logs -n EnrollmentFunction --stack-name facepass-pwa-prod --tail

# Xem logs của hàm Quản lý sinh viên & Xóa GDPR
sam logs -n StudentsFunction --stack-name facepass-pwa-prod --tail

# Xem logs của hàm Lớp học & Rekognition Collection
sam logs -n ClassesFunction --stack-name facepass-pwa-prod --tail
```

### Xử Lý Các Sự Cố Phổ Biến:

1. **Gmail chặn đăng nhập (`535 5.7.8 Authentication credentials invalid`):**
   - *Nguyên nhân:* Mật khẩu ứng dụng (App Password) bị nhập sai, bị thu hồi trên Google Account, hoặc tài khoản Gmail chưa bật Xác minh 2 bước.
   - *Cách khắc phục:* Vào lại Google Account -> Bảo mật -> Tạo lại App Password 16 ký tự mới. Vào AWS Systems Manager Parameter Store tại Region `us-east-1`, chỉnh sửa lại giá trị tham số `/facepass/gmail/app_password`.
2. **Google chặn đăng nhập từ IP máy chủ lạ (AWS Lambda):**
   - *Nguyên nhân:* Google phát hiện kết nối SMTP xuất phát từ dải IP của AWS Datacenter và tạm thời gắn cờ bảo mật.
   - *Cách khắc phục:* Đăng nhập vào chính hộp thư Gmail của tài khoản gửi (trên web), tìm email cảnh báo bảo mật từ Google ("Đã chặn nỗ lực đăng nhập"), bấm vào đường dẫn và chọn **"Đúng là tôi"** để xác nhận cấp quyền cho IP của Lambda.
   - *Lưu ý về hạn mức gửi:* Tài khoản Gmail cá nhân miễn phí có giới hạn gửi khoảng **100 – 500 emails/ngày**. Lưu ý không vượt quá hạn mức này.
3. **Lỗi CORS trên trình duyệt (`No 'Access-Control-Allow-Origin' header`):**
   - *Nguyên nhân:* Truy cập ứng dụng qua IP hoặc domain tùy chỉnh khác ngoài domain CloudFront được sinh ra trong stack hoặc `http://localhost:5173`.
   - *Cách khắc phục:* Luôn truy cập ứng dụng qua đường link HTTPS chính thức được cấp bởi `CloudFrontDomain`.
4. **Lỗi 401 Unauthorized:**
   - *Nguyên nhân:* JWT Token của giảng viên đã hết hạn (sau 60 phút), hoặc `VITE_COGNITO_CLIENT_ID` trong `.env.production.local` không khớp với `UserPoolClientId`.
   - *Cách khắc phục:* Đăng xuất và đăng nhập lại trên giao diện để nhận token mới.
5. **Lỗi 403 Forbidden khi thao tác dữ liệu:**
   - *Nguyên nhân:* Giảng viên đang cố gắng truy cập hoặc chỉnh sửa lớp học thuộc quyền sở hữu của một Giảng viên khác (quy tắc bảo mật phân quyền sở hữu lớp `verify_class_ownership`).

---

## 🧪 8. Thứ Tự Smoke Test Thực Tế & Cách Đọc Lỗi Khi Triển Khai Lần Đầu

Để kiểm chứng toàn diện luồng hoạt động thực tế trên hạ tầng AWS sau khi deploy, hãy thực hiện kiểm thử theo **đúng thứ tự 6 bước tuần tự** dưới đây:

### 1. Thứ Tự 6 Bước Smoke Test Luồng Nghiệp Vụ
1. **Bước 1: Đăng nhập Giảng viên (Cognito Login):**
   - *Thao tác:* Mở ứng dụng PWA qua tên miền `https://$CLOUDFRONT_DOMAIN`, đăng nhập bằng tài khoản Giảng viên (đổi mật khẩu nếu là lần đầu).
   - *Theo dõi logs:*
     ```powershell
     sam logs -n ClassesFunction --stack-name facepass-pwa-prod --tail
     ```
   - *Kỳ vọng:* Nhận được JWT Token hợp lệ, chuyển hướng vào màn hình Quản lý Lớp học.
2. **Bước 2: Tạo Lớp học Mới (`CreateCollection`):**
   - *Thao tác:* Bấm nút "Thêm Lớp Học", nhập tên lớp (ví dụ: `Điện toán đám mây - Nhóm 1`).
   - *Theo dõi logs:*
     ```powershell
     sam logs -n ClassesFunction --stack-name facepass-pwa-prod --tail
     ```
   - *Kỳ vọng:* DynamoDB lưu bản ghi lớp trước (với `attribute_not_exists(classId)`), sau đó Amazon Rekognition tạo collection `facepass-<classId>`. Trả về `HTTP 201`.
3. **Bước 3: Thêm Sinh Viên Vào Lớp:**
   - *Thao tác:* Chọn lớp vừa tạo, bấm "Thêm sinh viên" (hoặc import CSV). Nhập MSSV, họ tên và địa chỉ email thật của sinh viên.
   - *Theo dõi logs:*
     ```powershell
     sam logs -n StudentsFunction --stack-name facepass-pwa-prod --tail
     ```
   - *Kỳ vọng:* Danh sách sinh viên được lưu vào DynamoDB `facepass-students-prod`.
4. **Bước 4: Đăng Ký Khuôn Mặt Sinh Viên (`DetectFaces`, `IndexFaces`):**
   - *Thao tác:* Bấm vào sinh viên -> Tích chọn cam kết đồng ý thu thập dữ liệu sinh trắc học -> Chụp ảnh chân dung rõ mặt -> Bấm "Đăng ký khuôn mặt".
   - *Theo dõi logs:*
     ```powershell
     sam logs -n EnrollmentFunction --stack-name facepass-pwa-prod --tail
     ```
   - *Kỳ vọng:* Client nhận URL Presigned POST và tải ảnh lên S3; Lambda gọi `DetectFaces` kiểm tra chất lượng và `IndexFaces` lưu vector vào collection; trong khối `finally`, **ảnh thô lập tức bị xóa vĩnh viễn khỏi S3**. Vào S3 Console kiểm tra bucket `PhotoStorageBucket`: thư mục `enrollments/` phải hoàn toàn rỗng.
5. **Bước 5: Điểm Danh Bằng Ảnh Góc Rộng Cả Lớp (`SearchFacesByImage`):**
   - *Thao tác:* Vào trang "Điểm danh" -> Chụp ảnh tập thể lớp học -> Bấm "Bắt đầu nhận diện".
   - *Theo dõi logs:*
     ```powershell
     sam logs -n AttendanceFunction --stack-name facepass-pwa-prod --tail
     ```
   - *Kỳ vọng:* Lambda phát hiện tất cả khuôn mặt, cắt ảnh từng mặt với +20% padding bằng Pillow, gọi `SearchFacesByImage` đối soát với collection và phân nhóm: Có mặt (>= 90%), Cần xác nhận (80 - 89.9%), Vắng mặt.
6. **Bước 6: Xác Nhận Điểm Danh & Gửi Cảnh Báo Vắng (`SSM`, `SMTP Gmail`):**
   - *Thao tác:* Giảng viên kiểm tra danh sách, xác nhận các sinh viên cần đối soát -> Bấm "Xác nhận & Gửi thông báo".
   - *Theo dõi logs:*
     ```powershell
     sam logs -n AttendanceFunction --stack-name facepass-pwa-prod --tail
     ```
   - *Kỳ vọng:* Khóa nguyên tử DynamoDB kích hoạt chống gửi trùng lặp; Lambda lấy thông tin xác thực từ Parameter Store (giải mã `SecureString`), kết nối TLS tới `smtp.gmail.com:587` và gửi email cảnh báo vắng riêng cho từng sinh viên vắng. Kiểm tra hòm thư của sinh viên (Inbox hoặc Spam/Junk; nếu vào Spam, bấm "Not Spam").

---

### 2. Bảng Tra Cứu Lỗi AWS & Cách Đọc Chẩn Đoán Thực Tế
Khi kiểm tra logs JSON qua `sam logs`, sử dụng bảng sau để xác định chính xác nguyên nhân và cách khắc phục:

| Mã Lỗi (`awsErrorCode` / Exception) | Ngữ Cảnh (`awsOperation` / Thành Phần) | Nguyên Nhân Cốt Lõi | Cách Khắc Phục Chi Tiết |
| :--- | :--- | :--- | :--- |
| `AccessDeniedException` | `DetectFaces`, `IndexFaces`, `SearchFacesByImage` | Thiếu quyền thao tác Rekognition hoặc LabRole chưa sẵn sàng. | Kiểm tra xem hàm Lambda đã cấu hình đúng `Role: !Sub "arn:aws:iam::${AWS::AccountId}:role/LabRole"` chưa và phiên Lab có đang hoạt động không. |
| `ParameterNotFound` | `GetParameters` (SSM Parameter Store) | Sai tên tham số hoặc sai Region. | Kiểm tra xem 2 tham số `/facepass/gmail/username` và `/facepass/gmail/app_password` đã được tạo đúng tại vùng **N. Virginia (`us-east-1`)** hay chưa. |
| `SMTPAuthenticationError` / `535 5.7.8` | `server.login` (SMTP Gmail) | Mật khẩu ứng dụng (App Password) sai hoặc tài khoản chưa bật 2FA. | Tạo lại App Password 16 ký tự mới trên Google Account, cập nhật lại tham số `/facepass/gmail/app_password` trong Parameter Store tại `us-east-1`. |
| `ResourceNotFoundException` | `SearchFacesByImage` / `DeleteFaces` | Thiếu Rekognition Collection của lớp học. | Lớp học chưa được tạo đúng quy trình hoặc collection `facepass-<classId>` đã bị xóa thủ công. Hãy tạo lớp học mới trên giao diện. |
| Lỗi CORS khi upload ảnh (`CORS error` / `403 Forbidden`) | Presigned POST lên S3 | URL Presigned POST thiếu hoặc sai tên Region (`us-east-1`). | Đảm bảo client S3 trong handler khởi tạo với `Config(region_name=AWS_REGION, signature_version="s3v4")` và `endpoint_url="https://s3.us-east-1.amazonaws.com"`. |
| `HTTP 429 Too Many Requests` | API Gateway Rate Limiting | Vượt quá giới hạn Throttling `20/10` (Burst 20, Rate 10 req/s). | Throttling đang bảo vệ hệ thống khỏi quá tải. **Giao diện (UI) hiển thị thông báo: "Hệ thống đang bận, vui lòng thử lại sau giây lát"** thay vì báo lỗi chung. |

---

## 🧹 9. Quy Trình Dọn Dẹp Toàn Diện Tránh Phát Sinh Chi Phí (Clean-Up / Teardown)

Khi môn học kết thúc hoặc không còn nhu cầu sử dụng, để đưa chi phí vận hành về 0 đồng và xóa toàn bộ dữ liệu:

### Bước 1: Xóa các Rekognition Collection
Liệt kê và xóa các collection nhận diện khuôn mặt của các lớp:
```powershell
# Liệt kê danh sách collections
aws rekognition list-collections --region us-east-1

# Xóa từng collection (ví dụ: facepass-cls-01)
aws rekognition delete-collection --collection-id "facepass-cls-01" --region us-east-1
```

### Bước 2: Làm Rỗng 2 S3 Bucket (Kiểm tra Versioning)
CloudFormation sẽ không thể xóa S3 Bucket nếu bên trong bucket còn chứa đối tượng. Mặc định template không bật tính năng Versioning:

```powershell
$FRONTEND_BUCKET = "facepass-frontend-123456789012-prod"
$PHOTO_BUCKET = "facepass-photos-123456789012-prod"

aws s3 rm "s3://$FRONTEND_BUCKET" --recursive --region us-east-1
aws s3 rm "s3://$PHOTO_BUCKET" --recursive --region us-east-1
```
> **Lưu ý về Bucket Versioning:** Nếu bạn đã bật thủ công tính năng Versioning trên AWS Console, lệnh `s3 rm` thông thường chỉ tạo delete-marker và không xóa sạch các phiên bản cũ. Trong trường hợp đó, bạn vào AWS S3 Console -> chọn từng bucket -> nhấn nút **Empty** -> gõ chữ *permanently delete* để xóa sạch toàn bộ các phiên bản.

### Bước 3: Xóa 2 Tham Số SSM Parameter Store
```powershell
aws ssm delete-parameter --name "/facepass/gmail/username" --region us-east-1
aws ssm delete-parameter --name "/facepass/gmail/app_password" --region us-east-1
```

### Bước 4: Xóa Các CloudWatch Log Groups
Kiểm tra cấu hình `FunctionName` trong template bằng lệnh:
```powershell
Select-String -Path backend\template.yaml -Pattern "FunctionName|DeletionPolicy|Versioning"
```
Xác nhận tên các hàm đã khớp đúng với danh sách `$FUNCTIONS` bên dưới và thực thi xóa sạch logs:
```powershell
$FUNCTIONS = @(
  "facepass-classes-prod",
  "facepass-students-prod",
  "facepass-enrollment-prod",
  "facepass-attendance-prod"
)

foreach ($fn in $FUNCTIONS) {
  aws logs delete-log-group --log-group-name "/aws/lambda/$fn" --region us-east-1 2>$null
}
```

### Bước 5: Kiểm Tra DeletionPolicy & Xóa Stack Bằng SAM CLI
Trong `backend/template.yaml`, toàn bộ các tài nguyên DynamoDB, Cognito, API Gateway, CloudFront và S3 đều **không đặt `DeletionPolicy: Retain`** (toàn bộ sẽ tự động được xóa đồng bộ cùng CloudFormation Stack).

Thực hiện xóa toàn bộ hạ tầng:
```powershell
Set-Location -Path C:\dev\facepass-pwa\backend
sam delete --stack-name facepass-pwa-prod --region us-east-1 --no-prompts
```

### Bước 6: Kiểm Tra Xác Nhận Cuối Cùng
Chạy lệnh kiểm tra xác nhận stack đã biến mất khỏi CloudFormation:
```powershell
aws cloudformation describe-stacks --stack-name facepass-pwa-prod --region us-east-1
```
> **Kết quả mong đợi:** AWS CLI trả về thông báo lỗi:  
> `ValidationError: Stack with id facepass-pwa-prod does not exist.`  
>
> ⚠️ **Khuyến nghị tài chính:** Hãy **kiểm tra lại trang AWS Billing & Cost Management sau 1–2 ngày** để chắc chắn chi phí đã dừng phát sinh từ bất kỳ dịch vụ hay tài nguyên ngầm nào.

### Bước 7: Kết Thúc Phiên Học AWS Academy
Để hoàn tất dọn dẹp và giải phóng tài nguyên phiên thực hành:
1. Quay lại trang AWS Academy Learner Lab.
2. Bấm nút **End Lab** để kết thúc phiên và đóng môi trường thực hành.
*(Khóa tạm thời của AWS Academy tự động hết hiệu lực sau tối đa 180 phút).*

---

## ⚠️ 10. Giới Hạn Đã Biết (Known Limitations)

1. **Hạn mức gửi thư của Gmail SMTP:**  
   Tài khoản Gmail cá nhân miễn phí có giới hạn gửi thông thường khoảng **100 – 500 emails/ngày**. Kiến trúc này tối ưu và tiết kiệm cho quy mô lớp học của từng giảng viên; nếu cần triển khai trên quy mô toàn trường với hàng nghìn sinh viên mỗi ngày, cần chuyển đổi sang Amazon SES Production (đã được AWS gỡ khỏi sandbox và cấp hạn mức cao).
2. **Thời gian chờ của HTTP API Gateway (30s Timeout):**  
   AWS HTTP API Gateway v2 quy định thời gian chờ kết nối tối đa cố định là 30 giây (không thể tăng). Do đó, Lambda Function xử lý ảnh được thiết lập timeout 25 giây để chủ động hoàn thành hoặc trả lỗi trước khi Gateway ngắt kết nối.
3. **Yêu cầu chất lượng ảnh chụp điểm danh:**  
   Ảnh tập thể cần được chụp bằng camera sau với độ phân giải khuyến nghị từ Full HD (1920x1080) đến 2560px, đủ ánh sáng và sinh viên hướng mặt về phía ống kính để Amazon Rekognition đạt độ tương đồng nhận diện cao nhất (>= 80%).
4. **Thời hạn của Access Token Cognito:**  
   Theo tiêu chuẩn bảo mật danh tính, Access Token và ID Token của giảng viên có thời hạn sống tối đa là 60 phút. Khi hết hạn, giảng viên chỉ cần đăng nhập lại để nhận token mới.
5. **Trường hợp hiếm có thể gửi trùng email khi ghi nhận trạng thái thất bại:**  
   Nếu email cảnh báo vắng đã được gửi thành công tới máy chủ SMTP Gmail nhưng ngay sau đó Lambda bị crash hoặc mất kết nối trước khi kịp ghi nhận trạng thái `sent` vào DynamoDB (bản ghi vẫn giữ trạng thái `processing`), sau khi hết 120 giây khóa hết hạn, hệ thống/giảng viên có thể thực hiện gửi lại và sinh viên sẽ nhận thêm một email thứ hai. Đây là sự đánh đổi chấp nhận được theo nguyên lý *At-least-once delivery* để đảm bảo tuyệt đối không bỏ sót cảnh báo vắng cho sinh viên.
6. **Chưa có cơ chế phát hiện sự sống (Liveness Detection):**  
   Hệ thống hiện chụp ảnh tĩnh và đối chiếu trực tiếp qua Amazon Rekognition mà chưa tích hợp kiểm tra cử động thực tế (Face Liveness / Challenge-Response). Do đó, ảnh in sẵn trên giấy hoặc hiển thị qua màn hình video điện thoại có thể qua mặt hệ thống nếu không có sự giám sát trực tiếp của giảng viên trong lớp.
7. **Độ chính xác nhận diện thực tế chưa được kiểm chứng trong lớp học thật:**  
   Ngưỡng 90% (Có mặt) và 80% (Cần xác nhận) là các giá trị khởi điểm theo thiết kế, chưa được kiểm chứng trên ảnh lớp thật mà mới chỉ chạy qua dữ liệu giả lập (mock). Trong môi trường giảng đường thực tế, cần chụp thử thực tế trên lớp học thật và tinh chỉnh lại các ngưỡng cho phù hợp. Giảng viên luôn cần kiểm tra, rà soát trực quan trên danh sách trước khi gửi thông báo chính thức.

---

## 🔒 11. Báo Cáo Rà Soát Quyền Hạn AWS Academy Sandbox (LabRole)

Trong môi trường **AWS Academy Sandbox**, tài khoản học viên bị hạn chế quyền tạo mới IAM Role hoặc IAM Policy (`iam:CreateRole`, `iam:PutRolePolicy`). Do đó, toàn bộ 4 hàm Lambda trong `backend/template.yaml` được cấu hình sử dụng trực tiếp IAM Role mặc định do AWS Academy cấp sẵn:  
`Role: !Sub "arn:aws:iam::${AWS::AccountId}:role/LabRole"`

Role `LabRole` này đã được AWS Academy gán sẵn đầy đủ các quyền hạn cần thiết để các Lambda Function thao tác với Amazon DynamoDB, Amazon Rekognition, Amazon S3, và AWS Systems Manager (SSM) Parameter Store (`GetParameters`).

**Cấu hình giới hạn tốc độ (API Gateway Throttling):**
`HttpApiGateway` được thiết lập `DefaultRouteSettings` ở cấp Stage `$default` với `ThrottlingRateLimit: 10` (requests/s) và `ThrottlingBurstLimit: 20` để chống tấn công từ chối dịch vụ (DoS), đồng thời không đặt `ReservedConcurrentExecutions` trên Lambda để tránh lỗi cạn kiệt quota trên các tài khoản AWS mới.

**CORS Bucket Ảnh (`PhotoStorageBucket`):**
CORS của bucket ảnh chỉ cho phép duy nhất `AllowedMethods: [POST]` phục vụ trực tiếp cho upload bằng Presigned POST từ trình duyệt, triệt tiêu nguy cơ tải về trái phép hoặc ghi đè từ bên ngoài.
