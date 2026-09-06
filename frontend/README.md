# RealTimeChat frontend

Frontend React/Vite của RealTimeChat. Tài liệu kiến trúc, cấu hình, API, E2EE và kiểm thử được duy trì tại [README của dự án](../README.md).

Luồng giao diện hiện tại nằm trong `src/features/` và `src/shared/`, được nối từ `src/App.jsx`. Chat riêng/nhóm hỗ trợ gửi văn bản, ảnh, sửa, thu hồi và trả lời một tin nhắn cụ thể.

## Lệnh thường dùng

Chạy các lệnh sau từ thư mục `frontend/`:

```powershell
npm install
npm run dev
npm test
npm run lint
npm run build
npm run preview
```

Nếu PowerShell chặn `npm.ps1`, dùng `npm.cmd` thay cho `npm`.

Các biến môi trường development trong `frontend/.env`:

```env
VITE_API_URL=http://localhost:3000/api
VITE_BACKEND_URL=http://localhost:3000
VITE_EVENTS_URL=http://localhost:3000/api/messages/events
```

E2EE cần HTTPS hoặc `localhost`, Web Crypto API và IndexedDB.

Khi build production cùng origin với backend, dùng `/api`, `/` và `/api/messages/events` tương ứng trong `.env.production`; không giữ URL localhost trong bundle triển khai. Đổi biến `VITE_*` cần build lại.

Vite hỗ trợ HTTPS development khi đặt cả `VITE_TLS_KEY_PATH` và `VITE_TLS_CERT_PATH` trong môi trường shell trước khi chạy dev; xem cấu hình đầy đủ ở README chính.
