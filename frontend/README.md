# RealTimeChat frontend

Frontend React/Vite của RealTimeChat. Tài liệu kiến trúc, cấu hình, API, E2EE và kiểm thử được duy trì tại [README của dự án](../README.md).

## Lệnh thường dùng

```powershell
npm install
npm run dev
npm test
npm run lint
npm run build
npm run preview
```

Các biến môi trường frontend đang được source sử dụng:

```env
VITE_API_URL=http://localhost:3000/api
VITE_BACKEND_URL=http://localhost:3000
VITE_EVENTS_URL=http://localhost:3000/api/messages/events
```

E2EE cần HTTPS hoặc `localhost`, Web Crypto API và IndexedDB.
