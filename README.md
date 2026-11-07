# 📱 FacePass PWA - Hệ Thống Điểm Danh Lớp Học Bằng Nhận Diện Khuôn Mặt (AWS Serverless)

Ứng dụng Progressive Web App (PWA) di động hỗ trợ Giảng viên điểm danh sinh viên bằng nhận diện khuôn mặt đa đối tượng, tích hợp cảnh báo vắng học qua Amazon SES.

- **Khu vực triển khai (Region):** `ap-southeast-1` (Singapore)
- **Kiến trúc:** AWS SAM, Lambda (Python 3.12), Amazon Rekognition, DynamoDB, S3, SES, Cognito, CloudFront, React 18, Vite, TypeScript, PWA.

---

## 📁 Cấu Trúc Dự Án (Project Structure)

```text
facepass-pwa/
├── backend/            # AWS SAM Serverless (Lambda Python 3.12, Rekognition, DynamoDB, SES, S3)
│   ├── src/            # Lambda handlers (classes, students, enrollment, attendance) & common libs
│   ├── tests/          # Bộ kiểm thử unit test tự động (24/24 test pass)
│   ├── layers/         # Pillow Lambda Layer cho xử lý cắt ảnh khuôn mặt
│   └── template.yaml   # AWS SAM CloudFormation Infrastructure Template
├── frontend/           # PWA Di Động (React 18 + Vite + TypeScript + Tailwind CSS)
│   ├── src/            # Components, Context, Pages, Mock API, Services
│   ├── public/         # PWA Manifest, favicon, icons
│   ├── package.json    # Mọi lệnh npm chạy trực tiếp trong frontend/
│   ├── vite.config.ts  # Cấu hình Vite PWA (NetworkOnly bypass cho /api và ảnh)
│   ├── .env.development# VITE_USE_MOCK=true (chế độ phát triển local)
│   └── .env.production # VITE_USE_MOCK=false (chế độ production AWS thật)
└── docs/               # Kế hoạch dự án, kiến trúc và quy chuẩn phát triển (PROJECT_PLAN.md)
```

> **Lưu ý quan trọng về lệnh thực thi:**
> - Mọi thao tác npm (`npm install`, `npm run dev`, `npm run build`) được thực thi bên trong thư mục `frontend/`.
> - Mọi thao tác SAM CLI (`sam build`, `sam validate`) và unit test backend được thực thi trong thư mục `backend/` hoặc từ root chỉ định đường dẫn.

---

## 🏗️ 1. Quy Trình Build Hạ Tầng Backend (Lưu Ý Bắt Buộc Về Pillow Layer)

Lambda Function xử lý cắt ảnh khuôn mặt (`Pillow`) có chứa thư viện C binary. Khi build trên máy tính cá nhân (Windows hoặc macOS), **bắt buộc phải build bằng Docker container** để nhắm đúng kiến trúc Linux của AWS Lambda:

```powershell
cd backend
sam build --use-container
```

> **Ghi chú quan trọng:** Cờ `--use-container` yêu cầu Docker Desktop đang chạy. SAM CLI sẽ tự động kéo image Amazon Linux tương ứng với Python 3.12 để biên dịch `Pillow` chuẩn xác, tránh lỗi `ELF binary format mismatch` khi chạy trên Lambda.

---

## 🔒 2. Quy Trình Triển Khai 2 Lượt Để Tránh Vòng Phụ Thuộc (Circular Dependency)

Do API Gateway cần cấu hình CORS domain cụ thể của CloudFront, trong khi CloudFront lại cần biết API Gateway endpoint:

### Lượt 1: Khởi tạo Hạ tầng và lấy Domain CloudFront
```powershell
sam deploy --guided --parameter-overrides AllowedCorsOrigin='https://localhost:5173'
```
Sau khi hoàn tất, lấy giá trị Output `CloudFrontUrl` (ví dụ: `https://d123456789.cloudfront.net`).

### Lượt 2: Khóa chặt CORS vào Domain CloudFront
```powershell
sam deploy --parameter-overrides AllowedCorsOrigin='https://d123456789.cloudfront.net'
```

---

## 📱 3. Hướng Dẫn Kiểm Thử Camera Điện Thoại Thật Qua HTTPS

Trình duyệt trên điện thoại (Chrome trên Android hoặc Safari trên iOS) **chặn tuyệt đối quyền truy cập camera (`navigator.mediaDevices.getUserMedia`)** nếu trang web không chạy trên giao thức bảo mật **HTTPS** (hoặc `localhost` trên máy tính).

Để kiểm thử camera trên điện thoại thật ở môi trường phát triển cục bộ:
1. **Cách 1 (Khuyên dùng):** Sử dụng CloudFront HTTPS sau khi deploy frontend.
2. **Cách 2 (Local Dev):** Bật cờ HTTPS trong Vite bằng plugin `@vitejs/plugin-basic-ssl` hoặc sử dụng tunnel an toàn HTTPS:
   ```bash
   npx localtunnel --port 5173
   # Hoặc:
   ngrok http 5173
   ```
   Mở đường link HTTPS do tunnel cấp trên trình duyệt điện thoại để cấp quyền camera bình thường.

---

## 🧹 4. Hướng Dẫn Xóa Sạch Tài Nguyên Sau Môn Học (sam delete)

Để tránh phát sinh bất kỳ chi phí nào sau khi kết thúc môn học:
1. Xóa toàn bộ file trong các S3 bucket (Frontend Bucket và Photo Storage Bucket).
2. Xóa các Rekognition Collection đã tạo cho từng lớp: `facepass-<classId>`.
3. Chạy lệnh tự động dọn dẹp toàn bộ CloudFormation Stack:
   ```powershell
   sam delete --stack-name facepass-pwa-prod
   ```

