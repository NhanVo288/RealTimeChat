# RealTimeChat

RealTimeChat là ứng dụng chat thời gian thực full-stack sử dụng React/Vite và Node.js/Express. Dự án hỗ trợ hội thoại trực tiếp, nhóm, nhiều tab/thiết bị, đồng bộ tin nhắn bị lỡ khi reconnect và mã hóa đầu cuối (E2EE) ngay trong trình duyệt.

## Mục lục

- [Tính năng](#tính-năng)
- [Công nghệ](#công-nghệ)
- [Kiến trúc và luồng dữ liệu](#kiến-trúc-và-luồng-dữ-liệu)
- [Cấu trúc dự án](#cấu-trúc-dự-án)
- [Yêu cầu](#yêu-cầu)
- [Cài đặt và cấu hình](#cài-đặt-và-cấu-hình)
- [Chạy local](#chạy-local)
- [API](#api)
- [Realtime, reconnect và chống mất tin](#realtime-reconnect-và-chống-mất-tin)
- [Unread và read cursor](#unread-và-read-cursor)
- [Phân trang](#phân-trang)
- [Thiết kế E2EE](#thiết-kế-e2ee)
- [Mô hình dữ liệu](#mô-hình-dữ-liệu)
- [Bảo mật và giới hạn](#bảo-mật-và-giới-hạn)
- [Production](#production)
- [Kiểm tra source](#kiểm-tra-source)

## Tính năng

### Tài khoản

- Đăng ký, đăng nhập, đăng xuất và kiểm tra phiên đăng nhập.
- Mật khẩu được băm bằng `bcryptjs` với salt trước khi lưu MongoDB.
- JWT có thời hạn 7 ngày, được lưu trong HTTP-only cookie và chứa `sessionId` riêng cho mỗi lần đăng nhập.
- Session được liên kết với đúng device E2EE; revoke device đồng thời vô hiệu hóa session và kết nối realtime.
- Cập nhật ảnh đại diện qua Cloudinary.
- Gửi email chào mừng bằng Resend sau khi đăng ký; lỗi gửi email không làm thất bại thao tác đăng ký.
- Route bảo vệ bằng JWT middleware và Arcjet (shield, bot detection, rate limit).

### Chat

- Chat trực tiếp giữa hai user.
- Tạo group từ tối thiểu 3 thành viên, bao gồm người tạo.
- Admin group có thể thêm thành viên, loại thành viên thường và xóa group.
- Gửi tin nhắn văn bản hoặc ảnh.
- Ảnh tin nhắn được chuyển thành data URL, đặt trong plaintext E2EE rồi mới mã hóa; giới hạn phía giao diện là 5 MB.
- Sửa và thu hồi tin nhắn do chính mình gửi.
- Optimistic message khi gửi và reconcile bằng message đã persist từ server.
- Preview tin nhắn mới nhất trong danh sách chat:
  - `Bạn: ...` cho tin do user hiện tại gửi;
  - `Tên người gửi: ...` trong group;
  - trạng thái riêng cho ảnh và tin đã thu hồi.
- Hiển thị trạng thái online theo user, hỗ trợ nhiều socket cho cùng một tài khoản.
- Infinite scroll để tải lịch sử cũ mà không làm nhảy vị trí đang đọc.
- Âm báo có thể bật/tắt và được lưu trong `localStorage`.

### Độ tin cậy realtime

- Backend persist message và cập nhật `Conversation.lastMessage` trước khi emit Socket.IO.
- Khi Socket.IO reconnect, frontend gọi API với cursor `after` để lấy toàn bộ message bị lỡ lúc offline.
- Message từ API và socket được merge theo `_id`, tránh tạo bản sao.
- Socket chỉ giải mã message mới vừa nhận, không giải mã lại toàn bộ lịch sử.
- Danh sách conversation được cập nhật local khi gửi/nhận message, không GET lại sau mỗi message.
- Các request lấy conversation đang chạy được gộp để tránh request trùng và loading loop.
- Listener được tháo bằng đúng handler đã đăng ký, không xóa listener của component khác.

### E2EE nhiều thiết bị

- Identity signing key riêng cho từng browser/device.
- Một static encryption key ECDH riêng cho từng device, được identity key ký xác nhận.
- Mỗi message có một AES-256-GCM key ngẫu nhiên.
- Mỗi device nhận một envelope ECDH/HKDF riêng chứa message key.
- Payload được ký ECDSA để xác thực device gửi và chống chỉnh sửa.
- TOFU pinning phát hiện identity key của device gửi bị thay đổi.
- Private key chỉ tồn tại trong IndexedDB của trình duyệt, không được gửi lên backend.

## Công nghệ

| Phần | Công nghệ |
| --- | --- |
| Frontend | React 19, Vite 7, React Router, Zustand, Axios |
| UI | Tailwind CSS 3, DaisyUI 4, Lucide React, React Hot Toast |
| Mã hóa client | Web Crypto API, IndexedDB |
| Backend | Node.js 20+, Express 4, Mongoose 8 |
| Realtime | Socket.IO 4 và Server-Sent Events (SSE) |
| Database | MongoDB |
| Xác thực | JWT, HTTP-only cookie, bcryptjs |
| Dịch vụ | Cloudinary, Resend, Arcjet |

## Kiến trúc và luồng dữ liệu

```text
React UI
  ├── Axios REST ───────────────> Express controllers ──> MongoDB
  ├── Socket.IO <─────────────── newMessage + online users
  ├── EventSource <───────────── group/edit/delete events
  └── Web Crypto + IndexedDB
        ├── giữ private device keys
        ├── mã hóa trước khi POST
        └── giải mã sau khi GET/socket
```

Backend chỉ nhận và lưu `encryptedPayload` của tin nhắn mới. Trình tự gửi message là:

1. Frontend tạo optimistic message để hiển thị ngay.
2. Frontend lấy public key bundle của tất cả device E2EE đang hoạt động thuộc các thành viên.
3. Frontend mã hóa nội dung và tạo envelope riêng cho từng device.
4. Backend xác thực cấu trúc payload, sender device, conversation context và độ phủ envelope.
5. Backend lưu message vào MongoDB.
6. Backend cập nhật `lastMessage` và `lastMessageAt` của conversation.
7. Backend emit `newMessage` tới các socket của người nhận.
8. Sender thay optimistic message bằng message server trả về; receiver giải mã đúng message mới và merge vào store.

## Cấu trúc dự án

```text
RealTimeChat/
├── backend/
│   └── src/
│       ├── controllers/        # auth, device, message, conversation
│       ├── middleware/         # JWT, socket auth, Arcjet, group admin
│       ├── model/              # MongoDB/Mongoose schemas
│       ├── routes/             # auth và message routes
│       ├── services/           # conversation, message, pagination, SSE
│       ├── lib/                # DB, socket, env, Cloudinary, Resend, Arcjet
│       └── server.js
├── frontend/
│   └── src/
│       ├── features/
│       │   ├── auth/           # auth pages và Zustand store
│       │   └── chat/           # chat UI, page và Zustand store
│       ├── shared/
│       │   ├── components/
│       │   └── lib/            # Axios và E2EE/Web Crypto
│       ├── App.jsx
│       └── main.jsx
├── package.json
└── README.md
```

Store đang được ứng dụng sử dụng là `frontend/src/features/chat/store/useChatStore.js`. Các file cũ ở `frontend/src/store/useChatStore.js` và `frontend/src/components/ChatContainer.jsx` không nằm trong import graph hiện tại.

## Yêu cầu

- Node.js `>= 20`.
- npm.
- MongoDB local hoặc MongoDB Atlas.
- Tài khoản Cloudinary nếu dùng cập nhật avatar.
- Tài khoản Resend nếu dùng welcome email.
- Arcjet key cho lớp bảo vệ request.
- Trình duyệt hỗ trợ Web Crypto API và IndexedDB.
- E2EE yêu cầu secure context: HTTPS hoặc `localhost`.

## Cài đặt và cấu hình

### 1. Cài dependency

Từ thư mục root:

```powershell
npm install --prefix backend
npm install --prefix frontend
```

### 2. Cấu hình backend

Tạo `backend/.env`:

```env
PORT=3000
NODE_ENV=development
MONGO_URI=mongodb://127.0.0.1:27017/realtime-chat
JWT_SECRET=replace-with-a-long-random-secret
CLIENT_URL=http://localhost:5173

CLOUD_NAME=your-cloudinary-cloud-name
CLOUD_API_KEY=your-cloudinary-api-key
CLOUD_API_SECRET=your-cloudinary-api-secret

RESEND_KEY=your-resend-api-key
EMAIL_FROM=no-reply@example.com
EMAIL_FROM_NAME=RealTimeChat

ARCJET_KEY=your-arcjet-key
ARCJET_ENV=development

# Tùy chọn: bật HTTPS trực tiếp trên backend
TLS_KEY_PATH=
TLS_CERT_PATH=
```

| Biến | Mục đích |
| --- | --- |
| `PORT` | Port backend lắng nghe |
| `NODE_ENV` | `development` hoặc `production` |
| `MONGO_URI` | Connection string MongoDB |
| `JWT_SECRET` | Secret ký và verify JWT |
| `CLIENT_URL` | Origin frontend cho CORS, Socket.IO và link trong email |
| `CLOUD_*` | Thông tin Cloudinary |
| `RESEND_KEY` | API key Resend |
| `EMAIL_FROM`, `EMAIL_FROM_NAME` | Danh tính người gửi email |
| `ARCJET_KEY`, `ARCJET_ENV` | Cấu hình Arcjet |
| `TLS_KEY_PATH`, `TLS_CERT_PATH` | Đường dẫn private key/certificate để backend chạy HTTPS |

### 3. Cấu hình frontend

Tạo `frontend/.env`:

```env
VITE_API_URL=http://localhost:3000/api
VITE_BACKEND_URL=http://localhost:3000
VITE_EVENTS_URL=http://localhost:3000/api/messages/events
```

| Biến | Mục đích |
| --- | --- |
| `VITE_API_URL` | Base URL cho Axios REST |
| `VITE_BACKEND_URL` | Base URL cho Socket.IO |
| `VITE_EVENTS_URL` | URL EventSource/SSE |

Nếu chạy Vite qua HTTPS, đặt hai biến process trước khi chạy:

```powershell
$env:VITE_TLS_KEY_PATH="C:\certs\localhost-key.pem"
$env:VITE_TLS_CERT_PATH="C:\certs\localhost.pem"
npm run dev --prefix frontend
```

E2EE không sử dụng shared secret trong `.env`. Không tạo `VITE_E2EE_SECRET`; mọi biến có prefix `VITE_` đều có thể xuất hiện trong bundle frontend và không phù hợp để chứa secret.

Không commit `.env`, JWT secret, API key, TLS private key hoặc dữ liệu IndexedDB chứa private key.

## Chạy local

Mở hai terminal tại project root.

Backend:

```powershell
npm run dev --prefix backend
```

Frontend:

```powershell
npm run dev --prefix frontend
```

Mặc định:

- Frontend: `http://localhost:5173`
- Backend/API: `http://localhost:3000`
- Health check: `GET http://localhost:3000/health`

Response health check:

```json
{ "status": "true" }
```

## API

Tất cả route `/api/messages/*` đều đi qua Arcjet và JWT/session authentication. Trong `/api/auth`, signup/login/logout đi qua Arcjet; các route profile/device/key còn yêu cầu JWT có `AuthSession` chưa hết hạn hoặc bị revoke.

### Auth

| Method | Endpoint | Auth | Body chính | Mô tả |
| --- | --- | --- | --- | --- |
| `POST` | `/api/auth/signup` | Không | `{ fullName, email, password }` | Tạo tài khoản; password tối thiểu 6 ký tự |
| `POST` | `/api/auth/login` | Không | `{ email, password }` | Tạo `AuthSession` và set JWT cookie có `sessionId` |
| `POST` | `/api/auth/logout` | Không | — | Revoke session hiện tại, xóa JWT cookie và ngắt realtime |
| `GET` | `/api/auth/check` | Có | — | Trả user của phiên hiện tại, không gồm password |
| `PUT` | `/api/auth/update-profile` | Có | `{ profilePic }` | Upload ảnh đại diện lên Cloudinary |

### Device và key bundle

| Method | Endpoint | Body chính | Mô tả |
| --- | --- | --- | --- |
| `GET` | `/api/auth/devices` | — | Liệt kê device chưa revoke của user |
| `PUT` | `/api/auth/devices/:deviceId` | Public identity key, public encryption key và chữ ký | Đăng ký/cập nhật public key bundle |
| `DELETE` | `/api/auth/devices/:deviceId` | — | Revoke device, session liên kết, Socket.IO và SSE |
| `POST` | `/api/auth/keys/bundles` | `{ context }` | Server suy ra thành viên từ context và trả public key của các device |
| `GET` | `/api/auth/keys/backup` | — | Lấy kho khóa lịch sử đã mã hóa và revision hiện tại |
| `PUT` | `/api/auth/keys/backup` | `{ backup, expectedRevision }` | Ghi kho khóa bằng compare-and-swap |

`deviceId` tối đa 100 ký tự. Identity key và encryption key đã đăng ký không được thay thế trên cùng một device. Endpoint bundle không tiêu thụ key và chỉ trả device thuộc direct chat hoặc group mà requester là thành viên.

Mỗi session chỉ được bind với một `deviceId`. Khi browser đăng nhập lại và đăng ký cùng device,
session cũ của device bị thay thế. Payload gửi message còn phải có `senderDeviceId` bind với chính
session thực hiện request. Cookie JWT từ trước bản nâng cấp được middleware tự tạo `AuthSession`
và cấp lại cookie mới ở request HTTP hợp lệ đầu tiên.

Frontend có trang `/security/devices`, mở từ biểu tượng khiên cạnh hồ sơ. Không thể revoke nhầm
browser hiện tại trên UI; revoke browser khác sẽ đăng xuất browser đó từ xa.
Nếu chủ tài khoản đăng nhập lại bằng mật khẩu trên browser đã bị revoke, client tạo identity/device
mới và bind session mới; cookie cũ không có mật khẩu không thể tự thực hiện bước phục hồi này.

### Direct chat

| Method | Endpoint | Body/query | Mô tả |
| --- | --- | --- | --- |
| `GET` | `/api/messages/contacts` | — | Lấy toàn bộ user khác, sắp xếp theo tên |
| `GET` | `/api/messages/chats` | — | Lấy các chat partner đã có conversation chung |
| `GET` | `/api/messages/:userId` | `limit`, `before` hoặc `after` | Lấy message của direct conversation |
| `POST` | `/api/messages/send/:userId` | `{ encryptedPayload }` | Tạo direct conversation nếu cần và gửi message |

Không thể chat với chính mình. Người nhận phải tồn tại và phải có ít nhất một device E2EE đã đăng ký để frontend tạo đủ envelope.

### Conversation và group

| Method | Endpoint | Body/query | Mô tả |
| --- | --- | --- | --- |
| `GET` | `/api/messages/conversations` | — | Danh sách conversation, members, last message và unread |
| `POST` | `/api/messages/groups` | `{ name, memberIds, avatar? }` | Tạo group; tên tối đa 100 ký tự, tối thiểu 3 thành viên |
| `GET` | `/api/messages/conversations/:id` | `limit`, `before` hoặc `after` | Lấy message của conversation nếu là member |
| `POST` | `/api/messages/conversations/:id/send` | `{ encryptedPayload }` | Gửi message vào group/conversation |
| `POST` | `/api/messages/conversations/:id/read` | `{ messageId }` | Tiến read cursor tới message thuộc conversation |
| `DELETE` | `/api/messages/conversations/:id` | — | Admin xóa group, memberships và toàn bộ message |
| `POST` | `/api/messages/conversations/:id/members/:memberId` | — | Admin thêm member |
| `DELETE` | `/api/messages/conversations/:id/members/:memberId` | — | Admin loại member thường |
| `GET` | `/api/messages/events` | — | Mở SSE stream |

Khi thêm member mới, `lastReadMessageId` của member đó được đặt bằng `lastMessage` hiện tại của group. Vì vậy message cũ không bị tính là unread; đồng thời device mới chỉ có thể giải mã message được gửi sau khi tham gia và có envelope dành cho nó.

### Sửa và thu hồi message

| Method | Endpoint | Body | Mô tả |
| --- | --- | --- | --- |
| `PATCH` | `/api/messages/:messageId` | `{ encryptedPayload }` | Người gửi mã hóa lại nội dung và sửa message |
| `DELETE` | `/api/messages/:messageId` | — | Người gửi thu hồi message |

Edit chỉ áp dụng cho message chưa bị thu hồi và user vẫn thuộc conversation. Khi thu hồi, backend xóa `encryptedPayload`, đặt `deletedAt` và phát SSE `message-deleted`.

### Dạng response phân trang

```json
{
  "messages": [],
  "hasMore": true,
  "nextCursor": "messageObjectId"
}
```

`GET /api/messages/:userId` có thể trả mảng rỗng nếu hai user chưa có direct conversation; frontend vẫn tương thích với response mảng cũ và response phân trang mới.

## Realtime, reconnect và chống mất tin

### Socket.IO

Socket handshake đọc JWT từ cookie, xác minh `AuthSession`, rồi gắn `socket.userId` và
`socket.sessionId`. Backend giữ `Map<userId, Set<socketId>>`, do đó một user có thể online đồng
thời ở nhiều tab hoặc thiết bị. Khi session bị revoke, server emit `session-revoked` rồi chủ động
disconnect mọi socket thuộc session đó.

| Event | Hướng | Payload | Mục đích |
| --- | --- | --- | --- |
| `getOnlineUser` | Server → client | Mảng user ID | Đồng bộ danh sách user online |
| `newMessage` | Server → client | Message đã persist | Nhận message realtime |
| `session-revoked` | Server → client | `{ reason }` | Xóa state đăng nhập trên browser bị thu hồi |

Direct message được emit đến tất cả socket của người nhận. Group message được emit đến các member khác người gửi. Sender đã có response HTTP để reconcile optimistic message nên frontend bỏ qua socket message do chính mình gửi nếu có.

Socket.IO client bật reconnect vô hạn, delay từ 1 đến 10 giây và timeout 20 giây. Mỗi lần `connect`, `socketConnectionVersion` tăng. `ChatPage` dùng version này để gọi `syncMissingMessages()`.

### SSE

`GET /api/messages/events` mở EventSource có cookie. Server gửi heartbeat mỗi 15 giây và tắt buffering qua header `X-Accel-Buffering: no`.
Mỗi stream cũng được index theo `sessionId`; revoke sẽ gửi `session-revoked` và đóng stream ngay.

| Event | Nội dung |
| --- | --- |
| `group-created` | Group vừa tạo |
| `member-added` | `conversationId` và member mới |
| `member-removed` | `conversationId` và `memberId` |
| `group-deleted` | `conversationId` |
| `message-updated` | Message sau khi edit |
| `message-deleted` | Message sau khi thu hồi |

Socket.IO được dùng cho đường nhận message mới có độ trễ thấp; SSE được dùng cho thay đổi group và mutation message.

### Reconnect catch-up

Khi reconnect:

1. Frontend lấy `_id` của message server mới nhất đang có trong conversation được chọn.
2. Gọi endpoint message với `after=<lastMessageId>&limit=100`.
3. Backend trả message theo thứ tự tăng dần.
4. Frontend tiếp tục gọi bằng `nextCursor` cho tới khi `hasMore=false`.
5. Mỗi page được giải mã rồi merge theo `_id`.
6. Cuối quá trình, frontend refetch conversation list để đồng bộ `lastMessage` và unread từ server.

Nếu conversation đang mở chưa có message local, frontend tải page đầu thay vì dùng `after`. Nếu chưa chọn conversation, reconnect chỉ đồng bộ conversation list.

## Unread và read cursor

`ConversationMember.lastReadMessageId` là read cursor riêng của mỗi user trong mỗi conversation. `unreadCount` được tính từ các message:

- thuộc conversation đó;
- do user khác gửi;
- chưa bị thu hồi;
- có `_id` lớn hơn `lastReadMessageId`.

Frontend không đánh dấu đã đọc chỉ vì socket reconnect hoặc conversation được refetch. Endpoint `/read` chỉ được gọi khi:

- conversation đang mở;
- tab có `visibilityState === "visible"`;
- cửa sổ đang focus;
- user đang ở gần cuối khung chat (cách đáy không quá 80 px);
- message cuối là message thật đã persist, không phải optimistic message.

Khi bắt đầu gọi `/read`, Zustand cập nhật optimistic `lastReadMessageId` và `unreadCount = 0` để badge biến mất ngay. Response server xác nhận cursor và số unread thực tế. Nếu request thất bại, frontend bỏ optimistic request marker và refetch conversation list để phục hồi giá trị đúng.

Để tránh race condition, response conversation cũ không được phép ghi đè một read cursor mới hơn đang chờ xác nhận. Tương tự, request conversation đồng thời dùng chung một promise thay vì tạo nhiều GET giống nhau.

Message realtime cập nhật local `lastMessage`, `lastMessageAt` và tăng unread cho message đến. Preview `lastMessage` được giải mã riêng; frontend không cần tải lại toàn bộ danh sách message. Nếu message thuộc một conversation hoàn toàn mới chưa có trong store, frontend mới thực hiện một GET conversation list im lặng.

## Phân trang

Hai endpoint message hỗ trợ cùng query:

```text
GET /api/messages/:userId?limit=30&before=<messageId>
GET /api/messages/conversations/:id?limit=30&before=<messageId>

GET /api/messages/:userId?limit=100&after=<messageId>
GET /api/messages/conversations/:id?limit=100&after=<messageId>
```

- Mặc định `limit=30`.
- Tối thiểu 1, tối đa 100.
- `before` tải message cũ hơn theo chiều ngược rồi backend đảo lại để response luôn theo thứ tự thời gian tăng dần.
- `after` tải message mới hơn theo chiều tăng dần, dùng cho reconnect catch-up.
- Nếu đồng thời có `after` và `before`, `after` được ưu tiên.
- Cursor dựa trên MongoDB ObjectId `_id`.

Khi user scroll gần đầu khung chat (không quá 80 px), frontend tải page cũ tiếp theo và bù chênh lệch `scrollHeight` để giữ nguyên message đang nhìn.

## Thiết kế E2EE

### Thuật toán và payload

Chuỗi thuật toán được khai báo trong payload:

```text
ECDH-P256/HKDF-SHA256/AES-256-GCM
```

Payload chính có dạng khái quát:

```json
{
  "version": 3,
  "algorithm": "ECDH-P256/HKDF-SHA256/AES-256-GCM",
  "senderUserId": "...",
  "senderDeviceId": "uuid",
  "senderSigningKey": { "kty": "EC", "crv": "P-256", "x": "...", "y": "..." },
  "context": "conversation:<id> hoặc direct:<sorted-user-ids>",
  "messageId": "client-generated UUID",
  "revision": 0,
  "contentType": "text hoặc image",
  "iv": "base64",
  "ciphertext": "base64",
  "envelopes": [
    {
      "userId": "...",
      "deviceId": "...",
      "ephemeralPublicKey": { "kty": "EC", "crv": "P-256", "x": "...", "y": "..." },
      "iv": "base64",
      "ciphertext": "base64"
    }
  ],
  "signature": "base64"
}
```

`ciphertext` chính chứa JSON `{ text, image }`. Mỗi envelope chứa cùng message key nhưng được bọc bằng wrapping key riêng của device.

### Khởi tạo device

Sau signup, login hoặc khôi phục phiên:

1. `initializeE2EE(userId)` kiểm tra secure context, Web Crypto và IndexedDB.
2. Client đọc device của user từ database IndexedDB `realtime-chat-e2ee-v1`, object store `keys`.
3. Nếu chưa có, client tạo UUID `deviceId`, identity key ECDSA P-256 và static encryption key ECDH P-256.
4. Identity private key ký canonical data gồm `deviceId` và public encryption key.
5. Client upload hai public key, chữ ký và metadata lên backend. Backend xác minh chữ ký trước khi lưu.
6. Khi có mật khẩu từ signup/login, client mở kho khóa lịch sử, hợp nhất khóa ECDH của device
   hiện tại rồi ghi lại ciphertext bằng compare-and-swap. Mật khẩu và plaintext của kho khóa
   không được gửi qua endpoint backup.

Device local từ protocol v1/v2 được tự động bổ sung static encryption key khi đăng nhập. Các private prekey cũ chỉ còn được giữ local để giải mã lịch sử v1/v2.

Khi login lại bằng mật khẩu, device v3 cũ có static private key non-extractable được tự động thay
bằng một device có khóa có thể backup. Khóa cũ vẫn được giữ local để browser gốc đọc lịch sử, còn
đăng ký public key cũ được revoke để message mới chỉ phụ thuộc vào khóa có thể đồng bộ.

Private key dùng trực tiếp được import lại thành `CryptoKey` với `extractable=false` trước khi lưu.
Device mới còn giữ bản PKCS#8 để đặt bên trong kho khóa đã mã hóa; dữ liệu này không được upload
dạng rõ. Kết nối IndexedDB được cache và dùng lại thay vì mở/đóng database cho từng thao tác.

### Mã hóa khi gửi

1. Tạo context: group dùng `conversation:<conversationId>`; direct dùng `direct:<hai-user-id-được-sort>`.
2. Gửi `context` lên endpoint bundle; backend tự xác định member hợp lệ và trả public identity/encryption key của mọi device v3 đang hoạt động, bao gồm device của sender.
3. Xác minh chữ ký ECDSA của encryption key và TOFU-pin identity của từng device nhận.
4. Tạo message key AES-256-GCM ngẫu nhiên.
5. Với mỗi device, chạy song song bằng `Promise.all`: tạo ephemeral ECDH key, derive secret, derive wrapping key HKDF và bọc message key.
6. Mã hóa `{ text, image }` bằng message key. AAD canonicalize version/algorithm/sender/context/message ID/revision/content type.
7. Canonicalize toàn bộ payload, bao gồm metadata trên và các envelope, rồi ký bằng identity ECDSA/SHA-256.

HKDF v3 dùng salt `realtime-chat:v3:<deviceId>` và info `message-key:<context>:<messageId>:<revision>`.

Backend không giải mã nhưng kiểm tra version/algorithm, chữ ký payload, sender identity, context, revision, active devices, độ phủ envelope, public JWK và giới hạn kích thước payload.

### Giải mã khi nhận

1. Xác minh chữ ký toàn payload bằng sender signing key.
2. Pin fingerprint `<x>.<y>` theo `senderDeviceId` bằng TOFU.
3. Tìm envelope có `deviceId` của device hiện tại; nếu không có thì tìm envelope khớp một khóa
   lịch sử của chính user đã được khôi phục từ kho khóa.
4. Lấy static ECDH private key tương ứng trong IndexedDB.
5. Kết hợp private key này với ephemeral public key trong envelope, derive wrapping key bằng ECDH + HKDF và mở message key.
6. Cache `CryptoKey` non-extractable cùng chữ ký payload theo `message-key:<userId>:<messageId>`. Khi edit tạo signature/revision mới, cache cũ bị thay và message key mới được unwrap.
7. Dùng message key, IV và AAD để giải mã nội dung.

Nếu signature sai, identity key thay đổi, thiếu envelope hoặc không còn private encryption key, client hiển thị lỗi không thể giải mã/xác thực thay cho plaintext.

### Tương thích và đánh đổi bảo mật

- Backend chỉ nhận message mới/edit ở protocol v3; frontend vẫn có nhánh giải mã message v1/v2 đã lưu nếu private prekey cũ còn trong IndexedDB.
- Bỏ prekey làm protocol, API và lifecycle đơn giản hơn: không claim, quota, rotate, refill hay fallback.
- v3 **không có forward secrecy**: nếu static ECDH private key của device bị lộ, kẻ tấn công có ciphertext đã ghi lại có thể mở các message v3 trước đó gửi cho device đó.
- Chưa có Double Ratchet nên cũng chưa có post-compromise security.
- Sau khi deploy v3, mỗi browser/device cũ cần đăng nhập ít nhất một lần để tạo và đăng ký static encryption key; trước đó device đó không nhận envelope v3 mới.

## Mô hình dữ liệu

### `User`

- `email`: unique, bắt buộc.
- `fullName`: bắt buộc.
- `password`: bcrypt hash.
- `profilePic`: Cloudinary URL hoặc chuỗi rỗng.
- Timestamps.

### `Device`

- Unique compound index `{ userId, deviceId }`.
- Public identity signing key, public static encryption key và chữ ký của encryption key.
- `authSessionId` trỏ đến session hiện đang sở hữu device.
- `lastSeenAt`, `revokedAt` và timestamps.
- Backend không lưu private device key dạng rõ.

### `AuthSession`

- UUID `sessionId` unique, `userId`, `deviceId`, user agent và thời điểm hoạt động gần nhất.
- `expiresAt` có TTL index; `revokedAt` cho logout, thay thế session hoặc revoke từ xa.
- JWT và Socket.IO đều bị từ chối nếu session không tồn tại, hết hạn hoặc đã revoke.

### `DeviceKeyBackup`

- Unique `userId`, revision tăng dần để chống lost update giữa nhiều browser.
- Chỉ chứa salt, IV, thông số KDF và ciphertext AES-GCM do frontend tạo.
- Backend kiểm tra định dạng/kích thước nhưng không thể giải mã nội dung kho khóa.

### `Conversation`

- `type`: `direct` hoặc `group`.
- `name`, `avatar` cho group.
- `lastMessage`, `lastMessageAt`, `createdBy` và timestamps.

### `ConversationMember`

- Unique compound index `{ conversationId, userId }`.
- `role`: `member` hoặc `admin`.
- `lastReadMessageId`, `unreadCount`.
- Có sẵn field `muted`, `pinned`; UI hiện tại chưa cung cấp thao tác thay đổi hai field này.

### `Message`

- `conversationId`, `senderId`, `type`.
- `isEncrypted`, `encryptedPayload`.
- `text` được để rỗng đối với message E2EE mới.
- `attachments` tồn tại trong schema/service, nhưng UI hiện tại mã hóa ảnh data URL bên trong payload thay vì upload attachment message lên Cloudinary.
- `replyTo` có trong schema nhưng UI hiện tại chưa triển khai reply.
- `editedAt`, `deletedAt` và timestamps.
- Index `{ conversationId: 1, _id: -1 }` phục vụ pagination.

## Bảo mật và giới hạn

### Metadata backend vẫn nhìn thấy

E2EE che nội dung `text` và `image`, nhưng backend vẫn thấy user/device/conversation ID, sender, thời gian, kích thước ciphertext, số envelope, quan hệ thành viên, online state và read cursor.

### Giới hạn thiết bị và lịch sử

- Khi signup hoặc login bằng mật khẩu, client đồng bộ một kho khóa lịch sử được mã hóa bằng
  PBKDF2-SHA256/AES-256-GCM. Backend chỉ lưu ciphertext và không có mật khẩu hay private key
  dạng rõ. Device mới có thể dùng các khóa lịch sử trong kho này để mở envelope của chính user.
- Khóa của browser được tạo trước khi cơ chế backup được triển khai là non-extractable nên không
  thể đưa ngược vào kho khóa. Message cũ chỉ có envelope cho những khóa legacy này vẫn cần được
  đọc trên browser gốc; các device được tạo sau bản cập nhật sẽ đồng bộ lịch sử bình thường.
- Xóa IndexedDB/browser profile làm mất private device key và cached message key trên device đó.
- Revoke device ngăn nhận envelope mới, vô hiệu hóa session liên kết và ngắt Socket.IO/SSE,
  nhưng không thể xóa dữ liệu private đã tồn tại trên device bị revoke.
- TOFU chưa có safety number/QR/out-of-band verification.
- Thu hồi message không thể xóa plaintext người nhận đã xem, chụp hoặc lưu trước đó.

### Cookie, CORS và HTTPS

- Cookie dùng `httpOnly`, `sameSite="none"`; `secure` bật ngoài development hoặc khi backend có TLS path.
- Production phải chạy HTTPS để cookie cross-site và Web Crypto hoạt động đúng.
- CORS REST có allowlist trong `backend/src/server.js` cộng thêm `CLIENT_URL`.
- Socket.IO CORS dùng `CLIENT_URL`, localhost HTTP và localhost HTTPS.
- Nếu deploy frontend/backend khác site, cần kiểm tra chính sách third-party cookie; ưu tiên cùng site hoặc reverse proxy cùng domain.

### Hạn chế hiện tại

- Automated test hiện bao phủ 14 test ở mức unit/protocol; chưa có integration test dùng MongoDB thật hoặc browser E2E tự động chạy qua nhiều tab/device và revoke session.
- Chưa có delivery/read receipt theo từng message cho phía sender; read cursor hiện phục vụ unread của chính user.
- Chưa có typing indicator, reply UI, file attachment tổng quát, mute/pin UI hoặc push notification.
- SSE client state và Socket user map nằm trong memory của một Node process. Khi scale ngang cần shared pub/sub và Socket.IO adapter như Redis.
- Việc tìm direct conversation hiện dựa trên giao của membership; production lớn nên cân nhắc direct-conversation key/index chuyên dụng.

## Production

Ở `NODE_ENV=production`, backend phục vụ trực tiếp `frontend/dist` và fallback route frontend về `index.html`.

Frontend production nên dùng URL tương đối:

```env
# backend/.env
NODE_ENV=production
CLIENT_URL=https://chat.example.com

# frontend/.env.production
VITE_API_URL=/api
VITE_BACKEND_URL=/
VITE_EVENTS_URL=/api/messages/events
```

Build và chạy từ root:

```powershell
npm run build
npm start
```

Trước khi deploy:

- đặt secret bằng secret manager;
- cấu hình HTTPS/reverse proxy;
- thêm domain thật vào `CLIENT_URL` và CORS allowlist nếu cần;
- tắt buffering cho SSE và đặt timeout proxy đủ dài;
- không cache response API/SSE;
- sao lưu MongoDB;
- đánh giá giới hạn body 10 MB vì ảnh message nằm trong encrypted JSON.

## Kiểm thử

### Chạy toàn bộ kiểm tra

```powershell
npm test
npm run lint --prefix frontend
npm run build --prefix frontend
```

Có thể chạy riêng từng phần:

```powershell
npm run test --prefix backend
npm run test --prefix frontend
npm run lint --prefix frontend
npm run build --prefix frontend
```

Kết quả kiểm tra hiện tại:

| Phần | Công cụ/lệnh | Số lượng | Trạng thái |
| --- | --- | ---: | --- |
| Backend unit/protocol | Node.js test runner | 8 test | Pass |
| Frontend crypto core | Node.js test runner | 6 test | Pass |
| Frontend static analysis | ESLint | Toàn bộ `frontend` | Pass |
| Frontend production bundle | Vite build | 1 build | Pass |

Backend test bao phủ:

- JWT bind `userId` với `sessionId` và cấu hình HTTP-only cookie.
- Xóa cookie khi logout dùng cùng cookie scope với lúc phát hành.
- Chữ ký identity của public encryption key theo đúng `deviceId`.
- Chữ ký payload bind message ID, sender ID và edit revision.
- Từ chối envelope trùng device và IV sai kích thước.
- Kiểm tra direct/group encryption context và canonical ordering.
- Kiểm tra shape envelope E2EE v3 không còn metadata pre-key cũ.
- Kiểm tra định dạng, KDF parameters và giới hạn kích thước encrypted key backup.

Frontend test bao phủ:

- Message-key cache bị invalid khi signature/revision thay đổi.
- Metadata được ký bind sender, message identity, revision và content type.
- Giữ tương thích canonical signature của payload v1 đã lưu.
- Identity pin được scope theo owner user, peer user và peer device.
- Chữ ký encryption key bind cả public key lẫn device ID.
- Hợp nhất historical device keys theo thứ tự ổn định và từ chối thay khóa cùng device ID.

Kiểm tra syntax toàn bộ backend:

```powershell
Get-ChildItem -Path backend/src -Filter *.js -Recurse |
  ForEach-Object { node --check $_.FullName }
```

Checklist kiểm tra thủ công:

1. Đăng nhập A và B trên hai browser profile khác nhau.
2. Gửi direct message khi cả hai online.
3. Cho B offline, A gửi nhiều message, sau đó B reconnect và xác nhận không mất/không trùng message.
4. Mở cùng tài khoản trên nhiều tab/device và xác nhận mọi device nhận envelope phù hợp.
5. Kiểm tra unread tăng khi chưa đọc và về 0 khi tab focus ở cuối khung chat.
6. Scroll lên lịch sử, nhận message mới và xác nhận UI không ép scroll xuống nếu không ở gần đáy.
7. Tạo group, thêm/loại member, sửa/thu hồi message và kiểm tra SSE.
8. Xác nhận backend lưu `text` rỗng và chỉ có `encryptedPayload` cho message E2EE mới.
9. Đăng nhập cùng tài khoản trên browser A và B; từ A mở `/security/devices` và revoke B.
10. Xác nhận B nhận `session-revoked`, xóa auth state, Socket.IO/SSE bị đóng và request tiếp theo bị trả `401`.
11. Gửi message mới từ một thành viên khác và xác nhận key bundle/envelope không còn device B đã revoke.
12. Thử gửi payload bằng sender device/session đã revoke và xác nhận backend từ chối.
13. Đăng nhập lại hợp lệ trên B bằng mật khẩu và xác nhận client tạo device ID mới, bind session mới và đồng bộ encrypted key backup.
14. Mở nhiều tab cùng browser, thay session bằng lần login mới và xác nhận tab cũ reconnect thay vì revoke nhầm session mới.

## License

Project hiện khai báo license `ISC` trong `package.json`.
