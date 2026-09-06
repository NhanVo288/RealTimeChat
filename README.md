# RealTimeChat

RealTimeChat là ứng dụng chat thời gian thực full-stack dùng React/Vite và Node.js/Express. Source hiện tại hỗ trợ chat trực tiếp, chat nhóm, đồng bộ khi reconnect, quản lý phiên theo thiết bị và mã hóa đầu cuối nhiều thiết bị ngay trong trình duyệt.

## Tính năng chính

- Đăng ký, đăng nhập, đăng xuất bằng HTTP-only cookie; access token 15 phút và refresh token rotation qua Redis/Upstash.
- Mỗi lần đăng nhập có một `AuthSession`; session được liên kết với thiết bị E2EE tương ứng.
- Quản lý và thu hồi thiết bị từ xa tại `/security/devices`; session, Socket.IO và SSE của thiết bị bị thu hồi sẽ bị ngắt.
- Chat trực tiếp và chat nhóm từ 3 thành viên.
- Admin nhóm có thể thêm thành viên, loại thành viên thường và xóa nhóm.
- Gửi nội dung văn bản hoặc ảnh đã mã hóa đầu cuối.
- Sửa và thu hồi tin nhắn do chính mình gửi.
- Trả lời một tin nhắn cụ thể trong chat riêng hoặc nhóm; xem trước, hủy trích dẫn và giữ trích dẫn khi tải lại lịch sử.
- Optimistic UI, danh sách hội thoại, preview tin nhắn cuối và số tin chưa đọc.
- Phân trang lịch sử bằng cursor, infinite scroll và đồng bộ tin bị lỡ sau reconnect.
- Trạng thái online hỗ trợ nhiều tab/thiết bị cho cùng một tài khoản.
- Thông báo âm thanh có thể bật/tắt và được lưu trong `localStorage`.
- Cập nhật avatar qua Cloudinary và gửi email chào mừng qua Resend.
- Arcjet bảo vệ request bằng shield, bot detection và rate limit.

## Công nghệ

| Phần | Công nghệ |
| --- | --- |
| Frontend | React 19, Vite 7, React Router 7, Zustand 5, Axios |
| UI | Tailwind CSS 3, DaisyUI 4, Lucide React, React Hot Toast |
| Mã hóa client | Web Crypto API, IndexedDB |
| Backend | Node.js 20+, Express 4, Mongoose 8 |
| Realtime | Socket.IO 4, Server-Sent Events |
| Lưu trữ | MongoDB cho dữ liệu ứng dụng; Redis/Upstash cho hash refresh token và TTL |
| Xác thực | JWT access/refresh token, Redis rotation, HTTP-only cookie, bcryptjs |
| Dịch vụ ngoài | Cloudinary, Resend, Arcjet |
| Test | Node.js test runner, ESLint, Vite build |

## Kiến trúc hiện tại

```text
React UI
  ├── REST/Axios ───────────────> Express controllers ──> MongoDB
  ├── Auth refresh/logout ─────> Express ──> Redis/Upstash (hash RT và TTL)
  ├── Socket.IO <─────────────── newMessage, online users, session revoke
  ├── EventSource/SSE <──────── group/member/message lifecycle events
  └── Web Crypto + IndexedDB
        ├── tạo và giữ private device keys
        ├── mã hóa trước khi gửi
        └── giải mã sau khi nhận từ API hoặc realtime
```

Backend chỉ lưu ciphertext và metadata cần để định tuyến/kiểm tra message. Frontend chịu trách nhiệm tạo khóa thiết bị, tạo envelope cho từng thiết bị nhận, ký payload, giải mã và pin identity key.

### Cấu trúc thư mục

```text
RealTimeChat/
├── backend/
│   ├── src/
│   │   ├── controllers/       # auth, device, message, conversation
│   │   ├── middleware/        # JWT/session, Socket.IO, Arcjet, group admin
│   │   ├── model/             # Mongoose schemas
│   │   ├── routes/            # REST routes
│   │   ├── services/          # session, message, pagination, conversation, SSE
│   │   ├── lib/               # DB, E2EE validation, Socket.IO, external services
│   │   └── server.js
│   └── test/
├── frontend/
│   ├── src/
│   │   ├── features/auth/     # auth pages và Zustand store
│   │   ├── features/chat/     # chat page, components và Zustand store
│   │   ├── features/security/ # quản lý thiết bị
│   │   ├── shared/            # components, Axios và E2EE
│   │   ├── App.jsx
│   │   └── main.jsx
│   └── test/
├── package.json
└── README.md
```

Các màn hình đang chạy được import từ `frontend/src/features/` và `frontend/src/shared/`. Repository còn các thư mục cũ như `frontend/src/components/` và `frontend/src/store/`; luồng chat hiện tại dùng `features/chat/`.

## Yêu cầu

- Node.js `20.19+` thuộc nhánh 20 hoặc `>= 22.12` và npm, theo yêu cầu của Vite 7/plugin React hiện tại. Root `package.json` mới khai báo mức rộng hơn là `>= 20`.
- MongoDB local hoặc MongoDB Atlas.
- Redis/Upstash khả dụng; backend chờ kết nối Redis trước khi mở cổng HTTP.
- Trình duyệt hỗ trợ Web Crypto API và IndexedDB.
- HTTPS hoặc `localhost` để trình duyệt cung cấp secure context cho E2EE.
- Tài khoản Cloudinary nếu dùng cập nhật avatar.
- `RESEND_KEY` để khởi tạo Resend client khi backend khởi động; source hiện tại chưa có chế độ bỏ qua email khi thiếu key.
- Arcjet key cho lớp bảo vệ request.

## Cài đặt

Từ thư mục root:

```powershell
npm install --prefix backend
npm install --prefix frontend
```

Nếu PowerShell chặn `npm.ps1` do execution policy, dùng `npm.cmd` thay cho `npm` trong các lệnh bên dưới.

### Backend

Tạo `backend/.env`:

```env
PORT=3000
NODE_ENV=development
MONGO_URI=mongodb://127.0.0.1:27017/realtime-chat
REDIS_URL=rediss://default:<PASSWORD>@<YOUR-DATABASE>.upstash.io:6379
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

# Tùy chọn khi backend tự phục vụ HTTPS
TLS_KEY_PATH=
TLS_CERT_PATH=
```

| Biến | Mục đích |
| --- | --- |
| `PORT` | Port HTTP/HTTPS của backend; cần đặt rõ, source không có giá trị mặc định |
| `NODE_ENV` | Môi trường chạy; ảnh hưởng cookie và static frontend |
| `MONGO_URI` | MongoDB connection string |
| `REDIS_URL` | Redis connection string; Upstash dùng `rediss://` (TLS), mặc định local là `redis://127.0.0.1:6379` |
| `JWT_SECRET` | Ký và xác minh JWT |
| `CLIENT_URL` | Frontend origin dùng cho CORS, Socket.IO và email |
| `CLOUD_NAME`, `CLOUD_API_KEY`, `CLOUD_API_SECRET` | Cấu hình Cloudinary |
| `RESEND_KEY`, `EMAIL_FROM`, `EMAIL_FROM_NAME` | Cấu hình email |
| `ARCJET_KEY`, `ARCJET_ENV` | Cấu hình Arcjet |
| `TLS_KEY_PATH`, `TLS_CERT_PATH` | Private key và certificate cho HTTPS tùy chọn |

### Redis/Upstash và refresh token rotation

Trong Upstash Console, mở database → **Connect → Node.js (node-redis)** và chép Redis connection URL vào `REDIS_URL` trong `backend/.env`. Client hiện tại là package `redis`, kết nối TCP qua TLS với `rediss://`; không đọc `UPSTASH_REDIS_REST_URL` hay `UPSTASH_REDIS_REST_TOKEN`. Nếu tự ghép URL, cần URL-encode password có ký tự đặc biệt. Xem [hướng dẫn node-redis của Upstash](https://upstash.com/docs/redis/search/adapters/node-redis).

Khởi động lại backend sau khi đổi cấu hình. Dùng Upstash không cần Docker. Nếu chạy Redis local, tự khởi động Redis rồi đặt `REDIS_URL=redis://127.0.0.1:6379`; repository hiện không có file Compose.

- Signup/login cấp cookie `jwt` chứa access token (15 phút) và cookie `refreshToken` có scope `/api/auth` (tối đa 7 ngày).
- Redis lưu SHA-256 của RT tại key `auth:refresh:<sessionId>`, với TTL khớp thời điểm hết hạn session MongoDB. Không lưu RT dạng rõ.
- `POST /api/auth/refresh` xác minh RT và session còn hiệu lực, dùng Lua để so sánh/thay hash nguyên tử, rồi cấp cặp token mới. Rotation giữ nguyên hạn cuối 7 ngày tính từ lúc tạo session.
- RT đã dùng, hết hạn hoặc bị thu hồi trả 401. Code hiện từ chối replay nhưng không tự thu hồi toàn bộ chuỗi RT khi phát hiện token cũ.
- Logout revoke session MongoDB, xóa key RT trong Redis, xóa cả hai cookie và ngắt Socket.IO/SSE. Access token hết hạn vẫn có thể logout. Lỗi lưu trữ trả 503 để client thử lại.
- Axios gom các request refresh đang chạy và thử lại API một lần sau 401. Web Locks phối hợp giữa các tab khi trình duyệt hỗ trợ. Luồng reconnect Socket.IO/SSE cũng thử phục hồi access token.
- Cookie JWT từ phiên bản trước khi tách access/refresh yêu cầu đăng nhập lại. Nếu Redis mất dữ liệu, RT tương ứng không còn hợp lệ; access token đã cấp vẫn được kiểm tra theo JWT và session MongoDB cho đến khi hết hạn hoặc session bị revoke.

### Frontend

Tạo `frontend/.env`:

```env
VITE_API_URL=http://localhost:3000/api
VITE_BACKEND_URL=http://localhost:3000
VITE_EVENTS_URL=http://localhost:3000/api/messages/events
```

| Biến | Mục đích |
| --- | --- |
| `VITE_API_URL` | Base URL của REST API |
| `VITE_BACKEND_URL` | Base URL của Socket.IO |
| `VITE_EVENTS_URL` | URL của SSE stream |

E2EE không đọc shared secret từ biến môi trường. Không đặt secret trong biến có prefix `VITE_` vì các biến này có thể xuất hiện trong bundle frontend.

Nếu muốn chạy Vite bằng HTTPS:

```powershell
$env:VITE_TLS_KEY_PATH="C:\certs\localhost-key.pem"
$env:VITE_TLS_CERT_PATH="C:\certs\localhost.pem"
npm run dev --prefix frontend
```

Không commit `.env`, JWT secret, API key, TLS private key hoặc dữ liệu IndexedDB chứa private key.

## Chạy ứng dụng

Mở hai terminal tại thư mục root.

Backend:

```powershell
npm run dev --prefix backend
```

Frontend:

```powershell
npm run dev --prefix frontend
```

Địa chỉ khi dùng cấu hình development mẫu ở trên:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`
- REST API: `http://localhost:3000/api`
- Health check: `GET http://localhost:3000/health`

Health check trả về:

```json
{ "status": "true" }
```

### Production

Lệnh build ở root cài dependency cho hai package và tạo `frontend/dist`:

```powershell
$env:NODE_ENV="production"
npm run build
npm start
```

Trước khi build production cùng origin với backend, bỏ các giá trị `VITE_API_URL`, `VITE_BACKEND_URL`, `VITE_EVENTS_URL` trỏ tới localhost khỏi `frontend/.env`, hoặc ghi đè trong `frontend/.env.production`:

```env
VITE_API_URL=/api
VITE_BACKEND_URL=/
VITE_EVENTS_URL=/api/messages/events
```

Nếu frontend/backend khác origin, đặt các URL HTTPS thực tế tương ứng. Các biến `VITE_*` được đóng vào bundle lúc build; đổi chúng cần build lại.

Khi `NODE_ENV=production`, backend phục vụ frontend đã build và fallback về `index.html` cho client-side routing. Cần cấu hình đúng `CLIENT_URL`, HTTPS/reverse proxy, cookie, MongoDB, `REDIS_URL` và các dịch vụ ngoài trước khi deploy.

## API

Các route `/api/messages/*` đều qua Arcjet và `protectRoute`. Các route auth công khai vẫn qua Arcjet; route profile, device và key yêu cầu session hợp lệ.

### Auth và thiết bị

| Method | Endpoint | Auth | Body chính | Chức năng |
| --- | --- | --- | --- | --- |
| `POST` | `/api/auth/signup` | Không | `{ fullName, email, password }` | Tạo user và session; mật khẩu tối thiểu 6 ký tự |
| `POST` | `/api/auth/login` | Không | `{ email, password }` | Tạo session, access token 15 phút và refresh token tối đa 7 ngày |
| `POST` | `/api/auth/refresh` | Refresh cookie | — | Xoay vòng refresh token trong Redis và cấp access token mới |
| `POST` | `/api/auth/logout` | Cookie nếu có | — | Revoke session và RT trong Redis, xóa cả hai cookie |
| `GET` | `/api/auth/check` | Có | — | Lấy user hiện tại, không gồm password |
| `PUT` | `/api/auth/update-profile` | Có | `{ profilePic }` | Upload và cập nhật avatar |
| `GET` | `/api/auth/devices` | Có | — | Liệt kê thiết bị chưa bị thu hồi |
| `PUT` | `/api/auth/devices/:deviceId` | Có | Device public-key bundle | Đăng ký thiết bị và bind session |
| `DELETE` | `/api/auth/devices/:deviceId` | Có | — | Thu hồi thiết bị và session liên kết |
| `POST` | `/api/auth/keys/bundles` | Có | `{ context }` | Lấy public key của các thiết bị nhận hợp lệ |
| `GET` | `/api/auth/keys/backup` | Có | — | Lấy encrypted key backup và revision |
| `PUT` | `/api/auth/keys/backup` | Có | `{ backup, expectedRevision }` | Ghi backup bằng compare-and-swap |

Một session chỉ bind với một `deviceId`. Public identity key và public encryption key không thể bị thay thế trên cùng device. Đăng ký lại device từ một session mới sẽ revoke session đang giữ device đó.

### Chat trực tiếp

| Method | Endpoint | Body/query | Chức năng |
| --- | --- | --- | --- |
| `GET` | `/api/messages/contacts` | — | Lấy các user khác, sắp xếp theo tên |
| `GET` | `/api/messages/chats` | — | Lấy các chat partner đã có conversation chung |
| `GET` | `/api/messages/:userId` | `limit`, `before` hoặc `after` | Lấy lịch sử direct chat |
| `POST` | `/api/messages/send/:userId` | `{ encryptedPayload, replyTo? }` | Tạo direct conversation nếu cần và gửi message |

Không thể chat với chính mình. User nhận phải tồn tại và có device E2EE đang hoạt động để client tạo đủ envelope.

### Conversation và nhóm

| Method | Endpoint | Body/query | Chức năng |
| --- | --- | --- | --- |
| `GET` | `/api/messages/conversations` | — | Lấy conversation, members, last message và unread |
| `POST` | `/api/messages/groups` | `{ name, memberIds, avatar? }` | Tạo nhóm có ít nhất 3 thành viên |
| `GET` | `/api/messages/conversations/:id` | `limit`, `before` hoặc `after` | Lấy message nếu requester là member |
| `POST` | `/api/messages/conversations/:id/send` | `{ encryptedPayload, replyTo? }` | Gửi message vào conversation |
| `POST` | `/api/messages/conversations/:id/read` | `{ messageId }` | Tiến read cursor và cập nhật unread |
| `DELETE` | `/api/messages/conversations/:id` | — | Admin xóa nhóm |
| `POST` | `/api/messages/conversations/:id/members/:memberId` | — | Admin thêm member |
| `DELETE` | `/api/messages/conversations/:id/members/:memberId` | — | Admin loại member thường |
| `GET` | `/api/messages/events` | — | Mở SSE stream |

Tên nhóm tối đa 100 ký tự. Khi thêm member, read cursor bắt đầu tại message cuối hiện có nên lịch sử trước thời điểm tham gia không được tính là unread.

### Message

| Method | Endpoint | Body | Chức năng |
| --- | --- | --- | --- |
| `PATCH` | `/api/messages/:messageId` | `{ encryptedPayload }` | Sender mã hóa lại và sửa message với revision kế tiếp |
| `DELETE` | `/api/messages/:messageId` | — | Sender thu hồi message |

Message mới và message sửa phải có payload E2EE hợp lệ, đúng sender, device của session, conversation context, message ID, revision và đầy đủ envelope cho mọi active device của thành viên.

### Trả lời một tin nhắn cụ thể

- Trong chat riêng hoặc nhóm, chọn biểu tượng **Trả lời** dưới tin nhắn của mình hoặc người khác. Khung soạn hiển thị tên người gửi và nội dung trích dẫn; ảnh không có chú thích hiển thị “Hình ảnh”.
- Bấm **×** hoặc **Esc** trong ô nhập để hủy trả lời. Chuyển cuộc trò chuyện cũng xóa lựa chọn trả lời.
- Gửi thành công sẽ xóa nội dung soạn và lựa chọn trả lời; gửi thất bại giữ lại để thử lại.
- Hai API gửi nhận `replyTo` tùy chọn là chuỗi MongoDB ObjectId của tin gốc; bỏ qua hoặc gửi `null` để gửi bình thường. Tin gốc phải thuộc cùng conversation, chưa bị thu hồi và không có type `system`; vi phạm trả `400`.
- MongoDB lưu tham chiếu `Message.replyTo`. Response gửi, lịch sử và cập nhật tin nhắn populate tin gốc cùng thông tin người gửi ở một cấp; không tải chuỗi trả lời lồng nhau. Lịch sử vẫn có trích dẫn khi tin gốc nằm ngoài trang đang tải.
- Nội dung tin gốc vẫn dùng encrypted payload và được giải mã tại client. `replyTo` là metadata bên ngoài payload đã ký; quan hệ trả lời do backend kiểm tra. Client không gửi bản sao plaintext của trích dẫn.
- Trích dẫn phản ánh nội dung hiện tại của tin gốc; khi nhận sự kiện thu hồi, giao diện hiển thị “Tin nhắn đã thu hồi”. Không thể chọn tin đang gửi tạm thời, tin hệ thống hoặc tin đã thu hồi để trả lời.

### Phân trang message

`GET` lịch sử trả về:

```json
{
  "messages": [],
  "hasMore": false,
  "nextCursor": null
}
```

- `limit` mặc định `30`, tối thiểu `1`, tối đa `100`.
- `before=<messageId>` tải các message cũ hơn.
- `after=<messageId>` tải các message mới hơn để catch up sau reconnect.
- Response sắp xếp message theo `_id` tăng dần (MongoDB ObjectId); cursor cũng dựa trên `_id`.
- Nếu direct conversation chưa tồn tại, endpoint direct trả mảng rỗng `[]`.

## Realtime và đồng bộ

### Socket.IO

Socket handshake đọc JWT cookie, xác minh `AuthSession` rồi gắn socket với user và session. Backend giữ nhiều socket cho một user.

| Event | Hướng | Nội dung |
| --- | --- | --- |
| `getOnlineUser` | Server → client | Danh sách user ID đang online |
| `newMessage` | Server → client | Message đã persist |
| `session-revoked` | Server → client | Lý do session bị thu hồi/thay thế |

Backend persist message và cập nhật `Conversation.lastMessage` trước khi emit. Client merge theo `_id`, reconcile optimistic message và chỉ giải mã message mới nhận.

Khi Socket.IO kết nối lại, frontend dùng message ID mới nhất làm cursor `after`, tải lặp đến khi `hasMore=false`, giải mã rồi merge. Cơ chế này bù các message bị lỡ trong lúc offline.

### Server-Sent Events

`GET /api/messages/events` dùng cookie authentication, gửi heartbeat mỗi 15 giây và phát các event:

- `group-created`
- `member-added`
- `member-removed`
- `group-deleted`
- `message-updated`
- `message-deleted`
- `session-revoked`

Socket.IO phụ trách message mới và presence; SSE phụ trách thay đổi conversation/message không thuộc luồng gửi mới. Thu hồi session sẽ đóng cả Socket.IO và SSE của session đó.

## E2EE hiện tại

Payload mới dùng `E2EE_VERSION = 3`; backend chỉ nhận payload gửi/sửa ở version này. Frontend còn nhánh giải mã version 1/2 nếu khóa legacy cần thiết vẫn có trong thiết bị. Thuật toán hiện tại:

```text
ECDH-P256 / HKDF-SHA256 / AES-256-GCM
```

Mỗi browser/device có:

- một identity signing key ECDSA P-256;
- một static encryption key ECDH P-256 được identity key ký xác nhận;
- một `deviceId` riêng;
- private key lưu trong IndexedDB, không gửi dạng rõ lên backend.

### Payload

```json
{
  "version": 3,
  "algorithm": "ECDH-P256/HKDF-SHA256/AES-256-GCM",
  "senderUserId": "...",
  "senderDeviceId": "...",
  "senderSigningKey": {},
  "context": "direct:<sorted-user-a>:<sorted-user-b>",
  "messageId": "...",
  "revision": 0,
  "contentType": "text",
  "iv": "base64",
  "ciphertext": "base64",
  "envelopes": [
    {
      "userId": "...",
      "deviceId": "...",
      "ephemeralPublicKey": {},
      "iv": "base64",
      "ciphertext": "base64"
    }
  ],
  "signature": "base64"
}
```

Direct context dùng hai user ID đã sort: `direct:<id-a>:<id-b>`. Group context dùng `conversation:<conversationId>`.

### Luồng gửi

1. Client lấy key bundle theo context; backend tự xác định danh sách member được phép.
2. Client tạo một AES-256-GCM message key ngẫu nhiên.
3. Với mỗi active device, client tạo ephemeral ECDH key và dùng HKDF để sinh wrapping key.
4. Message key được mã hóa thành một envelope riêng cho từng device, bao gồm device của sender.
5. `{ text, image }` được mã hóa bằng message key; metadata xác thực được dùng làm AAD.
6. Toàn bộ payload được ký bằng identity signing key của device gửi.
7. Backend kiểm tra shape, chữ ký, context, sender/session binding, revision và độ phủ envelope trước khi lưu.

### Luồng nhận

1. Client kiểm tra version/algorithm và chữ ký payload.
2. Client đối chiếu sender, message ID, revision và conversation context với record từ server.
3. Identity key của peer device được pin theo TOFU; thay đổi key sẽ làm xác thực thất bại.
4. Client chọn envelope dành cho device hiện tại hoặc private key lịch sử đã đồng bộ.
5. Client dùng ECDH/HKDF để mở message key, sau đó AES-GCM giải mã nội dung.
6. Message key non-extractable được cache theo user/message/signature; edit làm cache cũ mất hiệu lực.

### Encrypted key backup

Khi signup/login có mật khẩu, frontend đồng bộ các static encryption private key lịch sử:

- KDF: `PBKDF2-SHA256`, `600000` vòng lặp;
- mã hóa backup: `AES-256-GCM`;
- optimistic concurrency: `expectedRevision`;
- merge theo `deviceId`, không cho phép thay private key của một device đã biết.

API backup chỉ nhận blob đã mã hóa và revision, không nhận private key dạng rõ. Mật khẩu được dùng tại client để dẫn xuất khóa backup, đồng thời vẫn được gửi tới API signup/login để xác thực; backend lưu password hash bằng bcrypt. Cần HTTPS khi triển khai.

## Mô hình dữ liệu

- `User`: email, họ tên, password hash, avatar.
- `AuthSession`: user, UUID session, device, user agent, last seen, expiry và revoke timestamp.
- `auth:refresh:<sessionId>` (Redis): hash SHA-256 của RT hiện tại, tự hết hạn theo session; rotation không gia hạn session.
- `Device`: user/device ID, session liên kết, public identity/encryption keys, chữ ký và trạng thái revoke.
- `DeviceKeyBackup`: encrypted backup duy nhất theo user và revision tăng dần.
- `Conversation`: loại direct/group, tên/avatar, creator và message cuối.
- `ConversationMember`: role, read cursor, unread count, mute và pin.
- `Message`: conversation, sender, loại nội dung, encrypted payload, client message ID, encryption revision, tham chiếu `replyTo`, edit/revoke timestamps.

## Bảo mật và giới hạn

- Với tin nhắn E2EE, backend không thấy plaintext text/ảnh nhưng vẫn thấy metadata: user, device, membership, thời gian, quan hệ trả lời (`replyTo`), kích thước ciphertext và traffic pattern.
- Ảnh được đưa vào plaintext JSON rồi mã hóa tại client; UI giới hạn ảnh 5 MB và backend giới hạn request body 10 MB.
- Cookie dùng `httpOnly`; `sameSite=lax` trên HTTP development, `sameSite=none` và `secure` ngoài development hoặc khi backend có TLS key.
- Revoke device ngăn nhận envelope mới và vô hiệu hóa session, nhưng không thể xóa dữ liệu đã lưu trên thiết bị từ xa.
- TOFU chưa có safety number, QR hoặc kênh xác minh ngoài ứng dụng.
- Thiết kế static ECDH chưa có forward secrecy hay post-compromise security như Double Ratchet.
- Thu hồi message không thể xóa plaintext mà người nhận đã xem, chụp hoặc lưu.
- Realtime state nằm trong memory của một Node process; scale ngang cần shared pub/sub và Socket.IO adapter.
- Chưa có typing indicator, delivery/read receipt cho sender, file attachment tổng quát hoặc push notification.

## Kiểm thử

Chạy toàn bộ test:

```powershell
npm test
```

Chạy riêng từng package và các kiểm tra frontend:

```powershell
npm run test --prefix backend
npm run test --prefix frontend
npm run lint --prefix frontend
npm run build --prefix frontend
```

Test hiện tại tập trung vào:

- JWT phân biệt access/refresh, thời hạn token và scope cookie phát hành/xóa.
- Rotation, từ chối RT cũ hoặc dùng đồng thời, logout với access token hết hạn, lỗi Redis và refresh chạy đồng thời với logout.
- Device encryption key được identity key ký đúng.
- Payload hiện tại bind sender, message ID, revision, content type và context.
- Shape payload/envelope, kích thước IV/ciphertext, duplicate device và public P-256 JWK.
- Direct/group context và canonical ordering.
- Định dạng encrypted key backup và tham số KDF.
- Cache message key, identity pin và merge historical device keys.
- Reply: từ chối ID sai định dạng, kiểm tra điều kiện lọc tin gốc theo conversation/trạng thái, lưu tham chiếu và populate trích dẫn mã hóa trong lịch sử ngoài trang hiện tại (mock Mongoose).

Mặc định chạy unit/protocol test; test controller auth mock MongoDB và Redis. Test tích hợp Lua với Redis thật tự skip nếu thiếu `REDIS_TEST_URL`. Chạy thêm test này bằng một Redis database dành cho kiểm thử:

```powershell
$env:REDIS_TEST_URL="rediss://default:<PASSWORD>@<TEST-DATABASE>.upstash.io:6379"
npm run test --prefix backend
```

Có thể dùng `redis://127.0.0.1:6379` nếu đã chạy Redis local. Test tạo key có session ID ngẫu nhiên rồi dọn key; kiểm tra rotation nguyên tử, TTL, expiry và revoke. Bộ test chưa khởi động MongoDB thật và chưa có browser end-to-end test tự động.

## License

ISC
