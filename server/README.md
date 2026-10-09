# Super Pupa Run API — บัญชีผู้เล่น · คลาวด์เซฟ · เติมเหรียญ

เซิร์ฟเวอร์ Node (Express) ตัวเล็ก ๆ สำหรับส่วนออนไลน์ของเกม

- **เข้าสู่ระบบด้วย Google** ผ่าน Firebase Authentication
- **คลาวด์เซฟ** — เหรียญ ของในตลาด ด่านที่ผ่าน เก็บไว้กับบัญชีใน Firestore
- **เติมเหรียญด้วยเงินจริง** ผ่าน Opn Payments (TrueMoney Wallet และ PromptPay QR)

| แพ็ก | ราคา | เหรียญ |
|---|---|---|
| ถุงเหรียญเล็ก | 20 บาท | 200 |
| ถุงเหรียญกลาง | 39 บาท | 450 |
| หีบเหรียญใหญ่ | 79 บาท | 1,000 |

(แก้ได้ที่ `PACKS` ใน `src/config.js` และ `PACKS` ใน `dist/account.js` · Opn ไม่รับยอดต่ำกว่า 20 บาท)

## รันทดสอบบนเครื่อง

```bash
cd server && npm install && npm run dev
```

ไม่ต้องมีคีย์อะไรเลย: เซิร์ฟเวอร์เข้า **dev mode** อัตโนมัติ (เก็บข้อมูลในหน่วยความจำ,
ปุ่ม "เข้าสู่ระบบ (ทดสอบ)" ในเกม, หน้าธนาคารจำลองที่ `/dev/pay/...` ให้กด "จ่ายสำเร็จ")
เปิดเกมที่ `http://localhost:5173` แล้วไปที่ ตลาด → เติมเหรียญ

เทส: `npm test`

## ตั้งค่าของจริง (ทำครั้งเดียว)

### 1. Firebase (ล็อกอิน Google + ฐานข้อมูล) — ฟรี

1. https://console.firebase.google.com → **Add project** (เช่น `super-pupa-run`)
2. **Build → Authentication → Get started → Sign-in method → Google → Enable** (ใส่อีเมลติดต่อ) → Save
3. **Authentication → Settings → Authorized domains → Add domain**: `super-pupa-run.onrender.com` และ `bmsjib5-ux.github.io`
4. **Build → Firestore Database → Create database → Production mode** → เลือก region `asia-southeast1` (สิงคโปร์)
5. **Project settings (⚙) → General → Your apps → `</>` (Web)** → ตั้งชื่อแอป → copy ค่า `firebaseConfig`
   ไปวางใน `dist/config.js` ตรง `firebase: { ... }`
6. **Project settings → Service accounts → Generate new private key** → ได้ไฟล์ JSON
   → เอา **ทั้งก้อน JSON** ไปใส่เป็นค่า env `FIREBASE_SERVICE_ACCOUNT` บน Render (ขั้นตอนที่ 3)
   ⚠️ ไฟล์นี้เป็นความลับ ห้าม commit เข้า git

### 2. Opn Payments (รับเงิน)

1. สมัครที่ https://dashboard.omise.co/signup → ยืนยันอีเมล
2. เริ่มจาก **Test mode** (สวิตช์มุมซ้ายล่างของแดชบอร์ด) ได้เลย
3. **Keys** → copy **Secret key** (`skey_test_...`) → env `OMISE_SECRET_KEY`
4. **Webhooks → Add endpoint**: `https://<ชื่อ API บน Render>.onrender.com/api/webhooks/omise`
5. ให้เปิดใช้ TrueMoney Wallet และ PromptPay ในบัญชี (Test mode เปิดให้ทดลองได้ทันที
   ส่วน Live mode ต้องส่งเอกสารร้านค้าให้ Opn อนุมัติก่อน แล้วค่อยเปลี่ยนเป็น `skey_live_...`)

ตอนทดสอบใน Test mode: TrueMoney จะพาไปหน้าจำลองของ Opn ให้กดสำเร็จ/ล้มเหลวเอง
ส่วน PromptPay ให้ไปที่ Dashboard → Charges → เปิดรายการ → **Mark as paid**

### 3. Render (เซิร์ฟเวอร์)

สร้าง **Web Service** จาก repo นี้ (region Singapore, plan Free ก็ได้)

| ช่อง | ค่า |
|---|---|
| Build command | `cd server && npm ci` |
| Start command | `cd server && npm start` |
| Health check path | `/api/health` |

Environment variables:

| ชื่อ | ค่า |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | JSON ทั้งก้อนจากข้อ 1.6 |
| `OMISE_SECRET_KEY` | `skey_test_...` (ภายหลังเปลี่ยนเป็น `skey_live_...`) |
| `APP_RETURN_URL` | `https://super-pupa-run.onrender.com/` (หน้าเกมที่ให้ TrueMoney ส่งกลับมา) |
| `APP_ORIGINS` | (ไม่ใส่ก็ได้) origin ของเกมที่อนุญาตให้เรียก API คั่นด้วย `,` |

เปิด `https://<api>.onrender.com/api/health` ต้องได้ `{"ok":true,"missing":[]}`
สุดท้ายเช็กว่า `apiBase` ใน `dist/config.js` ชี้มาที่ API ตัวนี้

> Plan Free จะหลับเมื่อไม่มีคนใช้ ~15 นาที ครั้งแรกที่ผู้เล่นกดเข้าสู่ระบบอาจรอ 30–50 วินาที
> ถ้าอยากให้ตอบทันทีตลอดให้ใช้ plan Starter

## การทำงานโดยย่อ

- `POST /api/login` · `PUT /api/save` — ยืนยัน ID token ของ Firebase แล้วรวมเซฟของเครื่องเข้ากับบัญชี
  (ดู `src/merge.js`: เหรียญใช้ "ส่วนต่างตั้งแต่ซิงก์ครั้งก่อน" เพื่อไม่ให้ทับยอดที่เติมเข้ามา)
- `POST /api/topup` — สร้าง charge กับ Opn แล้วจำเป็นออเดอร์สถานะ `pending`
- `GET /api/orders/:id` — เกมถามสถานะทุก 3 วิ ถ้า Opn บอกว่าจ่ายแล้วจะเครดิตเหรียญทันที
- `POST /api/webhooks/omise` — Opn แจ้งเมื่อ charge เสร็จ (เซิร์ฟเวอร์ดึง charge มาดูเองก่อนเชื่อ)
- เหรียญเครดิตได้ครั้งเดียวต่อออเดอร์ (transaction ใน Firestore) และไม่มีทางเครดิตจาก client
