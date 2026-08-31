# RealTimeChat

Ứng dụng chat thời gian thực xây dựng bằng React/Vite và Node.js/Express, hỗ trợ direct chat, group chat và mã hóa đầu cuối đa thiết bị.

## Tính năng

- Đăng ký, đăng nhập bằng JWT trong HTTP-only cookie.
- Direct chat và group chat.
- Quản trị nhóm: tạo/xóa nhóm, thêm và loại thành viên.
- Gửi, sửa và thu hồi tin nhắn.
- Tin nhắn văn bản và ảnh được mã hóa đầu cuối trước khi rời trình duyệt.
- Ảnh trong tin nhắn tối đa 5 MB; ảnh đại diện được lưu qua Cloudinary.
- Realtime message qua Socket.IO tới tất cả phiên online của người nhận.
- Realtime group/message events qua Server-Sent Events (SSE).
- Cursor pagination và infinite scroll cho lịch sử tin nhắn.
- E2EE đa thiết bị với identity key, signed prekey, one-time prekey, forward secrecy và key rotation.

## Công nghệ

- Frontend: React 19, Vite, Zustand, Axios, Tailwind CSS, DaisyUI, Web Crypto API và IndexedDB.
- Backend: Node.js 20+, Express, MongoDB/Mongoose và Socket.IO.
- Dịch vụ: Cloudinary, Resend và Arcjet.

## Cấu trúc

```text
backend/src/
├── controllers/       # auth, device, message, conversation
├── middleware/        # auth, Arcjet, socket auth, group admin
├── model/             # User, Device, Message, Conversation, ConversationMember
├── routes/            # auth.route.js, message.route.js
├── services/          # conversation, message, pagination, SSE
├── lib/               # database, socket, TLS, Cloudinary, Resend
└── server.js

frontend/src/
├── features/auth/     # auth pages và store
├── features/chat/     # chat UI và store
├── shared/lib/        # Axios và E2EE/Web Crypto
├── shared/components/ # shared UI
└── App.jsx
```

## Yêu cầu

- Node.js `>=20`
- npm
- MongoDB
- Trình duyệt hỗ trợ Web Crypto API, IndexedDB và secure context

Web Crypto hoạt động trên HTTPS hoặc `localhost`. Production bắt buộc dùng HTTPS.

## Cài đặt

```powershell
npm install --prefix backend
npm install --prefix frontend
```

Tạo `backend/.env`:

```env
PORT=3000
NODE_ENV=development
MONGO_URI=mongodb://127.0.0.1:27017/realtime-chat
JWT_SECRET=replace-with-a-long-random-secret
CLIENT_URL=http://localhost:5173

CLOUD_NAME=your-cloudinary-name
CLOUD_API_KEY=your-cloudinary-key
CLOUD_API_SECRET=your-cloudinary-secret

RESEND_KEY=your-resend-key
EMAIL_FROM=no-reply@example.com
EMAIL_FROM_NAME=RealTimeChat

ARCJET_KEY=your-arcjet-key
ARCJET_ENV=development

# Không bắt buộc khi chạy local qua HTTP
TLS_KEY_PATH=
TLS_CERT_PATH=
```

Tạo `frontend/.env`:

```env
VITE_API_URL=http://localhost:3000/api
VITE_BACKEND_URL=http://localhost:3000
VITE_EVENTS_URL=http://localhost:3000/api/messages/events
```

E2EE không dùng shared secret trong biến môi trường. Không cần và không nên tạo `VITE_E2EE_SECRET`.

Không commit file `.env`, private key TLS hoặc secret thật.

## Chạy local

Mở hai terminal:

```powershell
cd backend
npm run dev
```

```powershell
cd frontend
npm run dev
```

Frontend mặc định chạy tại `http://localhost:5173`, backend tại `http://localhost:3000`.

Nếu backend có đủ `TLS_KEY_PATH` và `TLS_CERT_PATH`, HTTP server sẽ chuyển sang HTTPS. Vite đọc đường dẫn certificate trực tiếp từ process environment; ví dụ trên PowerShell:

```powershell
$env:VITE_TLS_KEY_PATH="C:\certs\localhost-key.pem"
$env:VITE_TLS_CERT_PATH="C:\certs\localhost.pem"
npm run dev --prefix frontend
```

## API

Tất cả API thiết bị và tin nhắn yêu cầu JWT hợp lệ, ngoại trừ đăng ký và đăng nhập.

### Auth và thiết bị

```text
POST   /api/auth/signup
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/check
PUT    /api/auth/update-profile
GET    /api/auth/devices
PUT    /api/auth/devices/:deviceId
DELETE /api/auth/devices/:deviceId
POST   /api/auth/keys/claim
```

`PUT /api/auth/devices/:deviceId` đăng ký public identity key, signed prekey và các one-time prekey. Private key không được gửi lên backend.

`POST /api/auth/keys/claim` claim một prekey cho từng thiết bị của các user nhận. Server ưu tiên one-time prekey và dùng signed prekey làm fallback khi kho tạm hết.

### Direct message

```text
GET    /api/messages/contacts
GET    /api/messages/chats
GET    /api/messages/:userId
POST   /api/messages/send/:userId
PATCH  /api/messages/:messageId
DELETE /api/messages/:messageId
```

### Group và conversation

```text
POST   /api/messages/groups
GET    /api/messages/conversations
GET    /api/messages/conversations/:id
POST   /api/messages/conversations/:id/send
POST   /api/messages/conversations/:id/read
GET    /api/messages/events
DELETE /api/messages/conversations/:id
POST   /api/messages/conversations/:id/members/:memberId
DELETE /api/messages/conversations/:id/members/:memberId
```

Xóa group, thêm member và loại member yêu cầu role `admin`. Sửa hoặc thu hồi message chỉ dành cho người gửi message đó.

Endpoint gửi và sửa tin nhắn chỉ chấp nhận `encryptedPayload` hợp lệ. Backend kiểm tra thiết bị gửi, context của conversation và envelope dành cho mọi thiết bị đang hoạt động của thành viên; plaintext không được lưu cho tin nhắn mới.

Conversation list trả về `lastMessage`, `lastMessageAt`, `lastReadMessageId` và `unreadCount`. `unreadCount` được tính từ các message của người khác nằm sau `lastReadMessageId`, vì vậy reconnect/refetch không tự đánh dấu đã đọc. Frontend chỉ gọi endpoint `/read` khi conversation đang mở, tab có focus và message cuối đang nằm trong vùng nhìn ở cuối khung chat.

## Realtime

Socket.IO sử dụng:

```text
newMessage
getOnlineUser
```

`newMessage` được phát tới tất cả socket đang kết nối của người nhận. Client chỉ giải mã tin mới vừa nhận rồi merge vào state, không giải mã lại toàn bộ lịch sử.

SSE endpoint:

```text
GET /api/messages/events
```

SSE events:

```text
group-created
member-added
member-removed
group-deleted
message-updated
message-deleted
```

Server gửi heartbeat SSE mỗi 15 giây để giữ kết nối.

## Pagination

```text
GET /api/messages/:userId?limit=30&before=<messageId>
GET /api/messages/conversations/:id?limit=30&before=<messageId>
GET /api/messages/:userId?limit=100&after=<lastMessageId>
GET /api/messages/conversations/:id?limit=100&after=<lastMessageId>
```

Response:

```json
{
  "messages": [],
  "hasMore": true,
  "nextCursor": "messageId"
}
```

Page mặc định có 30 message, tối đa 100. Frontend tự tải tin cũ khi scroll lên và giữ nguyên vị trí scroll.

Cursor `before` dùng để tải lịch sử cũ. Cursor `after` trả message theo chiều tăng dần và được frontend gọi sau khi Socket.IO reconnect để lấy các message phát sinh trong lúc offline. Client tiếp tục gọi theo `nextCursor` cho tới khi `hasMore` bằng `false`, sau đó giải mã và merge theo `_id` để không tạo bản sao khi API sync và event realtime đến đồng thời.

## Thiết kế E2EE

### Khóa thiết bị

- Mỗi browser profile tạo một `deviceId`, identity signing key ECDSA P-256, signed prekey ECDH P-256 và ban đầu 30 one-time prekey.
- Private key chỉ nằm trong IndexedDB dưới dạng `CryptoKey` không export được; backend chỉ lưu public JWK và chữ ký.
- Client giữ một kết nối IndexedDB dùng chung thay vì mở/đóng database cho từng thao tác.
- Identity key của thiết bị gửi được pin theo TOFU để phát hiện việc thay đổi khóa sau lần gặp đầu tiên.

### Gửi tin nhắn

1. Client claim key bundle cho mọi thiết bị của các thành viên, bao gồm thiết bị của người gửi.
2. Client xác minh chữ ký ECDSA của từng prekey.
3. Mỗi tin nhắn nhận một khóa AES-256-GCM ngẫu nhiên.
4. Với mỗi thiết bị, client tạo ephemeral ECDH key, dẫn xuất wrapping key bằng HKDF-SHA-256 rồi bọc message key vào một envelope riêng.
5. Nội dung `{ text, image }` được mã hóa; toàn bộ payload được ký bằng identity key của thiết bị gửi.
6. Context của direct/group chat được đưa vào chữ ký và AES additional authenticated data để chống phát lại ciphertext sang conversation khác.

Các envelope và prekey được tạo song song bằng `Promise.all` để giảm thời gian gửi khi conversation có nhiều thiết bị.

### Nhận tin nhắn và forward secrecy

- Client chọn envelope khớp với `deviceId`, thực hiện ECDH/HKDF, mở message key rồi giải mã nội dung.
- Message key đã mở được cache cục bộ để thiết bị có thể đọc lại lịch sử.
- One-time private prekey được xóa khỏi thiết bị sau khi sử dụng; public one-time prekey đã bị lấy khỏi server ngay lúc claim.
- Signed prekey tự xoay sau 7 ngày. Khi kho one-time prekey còn dưới 10 khóa, client bổ sung tới 30 khóa; emergency refill tạo thêm 20 khóa khi server phải fallback sang signed prekey.
- Refill và rotation chạy qua một hàng đợi background, không chặn đường giải mã và hiển thị tin realtime.

Cơ chế one-time prekey đem lại forward secrecy trước việc identity/signed-prekey bị lộ về sau. Đây không phải Double Ratchet và chưa cung cấp post-compromise security đầy đủ như Signal Protocol.

### Metadata và giới hạn

- Backend không đọc được nội dung text hoặc ảnh của tin nhắn mới, nhưng vẫn thấy metadata cần để vận hành: user/device ID, conversation ID, sender, thời gian, kích thước ciphertext và số envelope.
- Thiết bị mới chỉ giải mã được tin gửi sau khi thiết bị đó đăng ký; dự án chưa có quy trình chuyển lịch sử hoặc private key giữa các thiết bị.
- Xóa IndexedDB hoặc browser profile sẽ làm mất private key và khả năng giải mã lịch sử trên thiết bị đó.
- TOFU phát hiện thay đổi sau lần pin đầu tiên nhưng chưa có safety number/QR để người dùng xác minh identity ngoài kênh.
- Tin nhắn theo định dạng `VITE_E2EE_SECRET` cũ không còn được hỗ trợ.

## Production

Backend production phục vụ trực tiếp `frontend/dist`. Cấu hình frontend dùng relative URL:

```env
NODE_ENV=production
CLIENT_URL=https://your-domain.example
VITE_API_URL=/api
VITE_BACKEND_URL=/
VITE_EVENTS_URL=/api/messages/events
```

Build và chạy từ project root:

```powershell
npm run build
npm start
```

## Kiểm tra

```powershell
npm run lint --prefix frontend
npm run build --prefix frontend
```

Kiểm tra syntax backend:

```powershell
Get-ChildItem -Path backend/src -Filter *.js -Recurse |
  ForEach-Object { node --check $_.FullName }
```
