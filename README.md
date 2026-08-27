# RealTimeChat

Ứng dụng chat realtime hỗ trợ:

- Direct chat và group chat.
- Admin tạo/xóa group, thêm và kick thành viên.
- Message realtime qua Socket.IO.
- Group events realtime qua SSE.
- Cursor pagination/infinite scroll.
- Mã hóa text bằng AES-GCM prototype.

## Stack

React, Vite, Zustand, Tailwind CSS, Node.js, Express, MongoDB/Mongoose, Socket.IO, Cloudinary và Resend.

## Yêu cầu

- Node.js `>=20`
- npm
- MongoDB local hoặc MongoDB Atlas

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

## Cấu trúc

```text
backend/src/
├── controllers/     # auth, message, conversation
├── middleware/      # auth, group admin, socket auth, Arcjet
├── model/           # User, Message, Conversation, ConversationMember
├── routes/          # auth và message routes
├── services/        # message, conversation, pagination, SSE
└── server.js

frontend/src/
├── features/auth/   # đăng nhập, đăng ký, auth store
├── features/chat/   # chat UI, store, crypto
├── shared/          # axios và component dùng chung
└── App.jsx
```

## API chính

Auth:

```text
POST /api/auth/signup
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/check
PUT  /api/auth/update-profile
```

Direct chat:

```text
GET  /api/messages/contacts
GET  /api/messages/chats
GET  /api/messages/:userId
POST /api/messages/send/:userId
```

Group chat:

```text
POST   /api/messages/groups
GET    /api/messages/conversations
GET    /api/messages/conversations/:id
POST   /api/messages/conversations/:id/send
GET    /api/messages/events                 # SSE
DELETE /api/messages/conversations/:id      # admin
POST   /api/messages/conversations/:id/members/:memberId # admin
DELETE /api/messages/conversations/:id/members/:memberId # admin
```

Người tạo group tự động là admin. `group-admin.middleware.js` bảo vệ các API quản trị group.

## Realtime và pagination

- Socket.IO event `newMessage` dùng cho direct/group message.
- SSE events: `group-created`, `member-added`, `member-removed`, `group-deleted`.
- Lịch sử tin nhắn dùng cursor:

```text
GET /api/messages/:userId?limit=30&before=<messageId>
GET /api/messages/conversations/:id?limit=30&before=<messageId>
```

Response:

```json
{ "messages": [], "hasMore": true, "nextCursor": "messageId" }
```

## E2EE prototype

Frontend mã hóa text bằng AES-GCM trước khi gửi. Backend chỉ lưu ciphertext; browser giải mã khi nhận history hoặc message realtime.

 Chưa có per-user key, device key, key exchange, forward secrecy hoặc key rotation.



Environment variables production tối thiểu:

```env
NODE_ENV=production
CLIENT_URL=https://your-app.onrender.com
VITE_API_URL=/api
VITE_BACKEND_URL=/
VITE_EVENTS_URL=/api/messages/events
VITE_E2EE_SECRET=your-secret
```

Root script sẽ build `frontend/dist`; backend production phục vụ thư mục này.

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

