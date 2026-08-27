# RealTimeChat

Ứng dụng chat realtime với React/Vite và Node.js/Express.

## Tính năng

- Đăng ký, đăng nhập bằng JWT HTTP-only cookie.
- Direct chat và group chat.
- Group admin: tạo group, xem member, thêm member, kick member, xóa group.
- Tin nhắn text/hình ảnh qua Cloudinary.
- Sửa và thu hồi tin nhắn của chính mình.
- Realtime message qua Socket.IO.
- Realtime group/message events qua SSE.
- Cursor pagination và infinite scroll.
- AES-GCM E2EE prototype cho nội dung text.

## Công nghệ

- Frontend: React 19, Vite, Zustand, Axios, Tailwind CSS, DaisyUI.
- Backend: Node.js 20+, Express, MongoDB/Mongoose, Socket.IO.
- Services: Cloudinary, Resend, Arcjet.

## Cấu trúc

```text
backend/src/
├── controllers/       # auth, message, conversation
├── middleware/        # auth, Arcjet, socket auth, group admin
├── model/             # User, Message, Conversation, ConversationMember
├── routes/            # auth.route.js, message.route.js
├── services/          # conversation, message, pagination, SSE
└── server.js

frontend/src/
├── features/auth/     # auth pages/store
├── features/chat/     # chat UI/store/crypto
├── shared/            # axios và shared components
└── App.jsx
```

## Cài đặt

Yêu cầu Node.js `>=20`, npm và MongoDB.

```powershell
npm install --prefix backend
npm install --prefix frontend
```

Tạo `backend/.env`:

```env
PORT=3000
NODE_ENV=development
MONGO_URI=mongodb://127.0.0.1:27017/realtime-chat
JWT_SECRET=your-secret
CLIENT_URL=http://localhost:5173

CLOUD_NAME=your-cloudinary-name
CLOUD_API_KEY=your-cloudinary-key
CLOUD_API_SECRET=your-cloudinary-secret
RESEND_KEY=your-resend-key
ARCJET_KEY=your-arcjet-key
ARCJET_ENV=development
```

Tạo `frontend/.env`:

```env
VITE_API_URL=http://localhost:3000/api
VITE_BACKEND_URL=http://localhost:3000
VITE_EVENTS_URL=http://localhost:3000/api/messages/events
VITE_E2EE_SECRET=your-development-e2ee-secret
```

Không commit `.env` hoặc secret thật.

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

Mở `http://localhost:5173`. Backend chạy tại `http://localhost:3000`.

## API

### Auth

```text
POST /api/auth/signup
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/check
PUT  /api/auth/update-profile
```

### Direct message

```text
GET   /api/messages/contacts
GET   /api/messages/chats
GET   /api/messages/:userId
POST  /api/messages/send/:userId
PATCH /api/messages/:messageId
DELETE /api/messages/:messageId
```

### Group/conversation

```text
POST   /api/messages/groups
GET    /api/messages/conversations
GET    /api/messages/conversations/:id
POST   /api/messages/conversations/:id/send
GET    /api/messages/events
DELETE /api/messages/conversations/:id
POST   /api/messages/conversations/:id/members/:memberId
DELETE /api/messages/conversations/:id/members/:memberId
```

Các API xóa group, thêm member và kick member yêu cầu role `admin`. API sửa/thu hồi message chỉ cho phép sender của message thực hiện.

## Realtime

Socket.IO dùng event `newMessage` cho tin nhắn direct/group.

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

## Pagination

Lịch sử tin nhắn dùng cursor pagination:

```text
GET /api/messages/:userId?limit=30&before=<messageId>
GET /api/messages/conversations/:id?limit=30&before=<messageId>
```

```json
{
  "messages": [],
  "hasMore": true,
  "nextCursor": "messageId"
}
```

Frontend tự tải tin cũ khi scroll lên và giữ nguyên vị trí scroll.

## E2EE prototype

Frontend mã hóa text bằng AES-GCM trước khi gửi. Backend chỉ lưu ciphertext trong `Message.text`; browser giải mã khi nhận history hoặc realtime message.

Chưa có per-user key, device key, key exchange, forward secrecy hoặc key rotation.


## Environment production:

```env
NODE_ENV=production
CLIENT_URL=https://your-app.onrender.com
VITE_API_URL=/api
VITE_BACKEND_URL=/
VITE_EVENTS_URL=/api/messages/events
VITE_E2EE_SECRET=your-secret
```

Root build script tạo `frontend/dist`; backend production phục vụ thư mục này.

## Kiểm tra

```powershell
cd frontend
npm run lint
npm run build
```

```powershell
cd backend
Get-ChildItem -Path src -Filter *.js -Recurse | ForEach-Object { node --check $_.FullName }
```
