# Workload Tracker

ระบบติดตามภาระงานและ Workflow การส่งตรวจเอกสารประกอบการประชุม (Board / Excom)

| | |
|---|---|
| **เว็บที่ใช้งานจริง** | https://workload-tracker-kappa.vercel.app |
| **โค้ด** | https://github.com/beau-bo-bo/workload-tracker (private) |
| **ฐานข้อมูล** | Supabase project `workload-tracker` (ap-southeast-1) |

> push ขึ้น branch `main` เมื่อไหร่ Vercel จะ build และ deploy ให้เองอัตโนมัติ

> 👉 **เพิ่งเข้ามารับงานต่อ หรือกำลังเปิดแชทใหม่กับ AI? อ่าน [START-HERE.md](START-HERE.md) ก่อน**

เอกสารประกอบ: [START-HERE.md](START-HERE.md) จุดเริ่มต้น · [AGENTS.md](AGENTS.md) กฎการทำงาน · [CODE-REVIEW.md](CODE-REVIEW.md) ผลตรวจโค้ด · [FIX-INSTRUCTIONS.md](FIX-INSTRUCTIONS.md) งานที่เหลือ · [PRODUCT.md](PRODUCT.md) ขอบเขต · [DESIGN.md](DESIGN.md) หน้าตา UI · [PLAN.md](PLAN.md) ลำดับการพัฒนา · [PROGRESS-TRACKER.md](PROGRESS-TRACKER.md) สถานะปัจจุบัน · [PROGRESS-ARCHIVE.md](PROGRESS-ARCHIVE.md) ประวัติเก่า

---

## เริ่มใช้งาน

```bash
npm install
```

สร้างไฟล์ `.env.local` โดยดูตัวอย่างจาก [.env.local.example](.env.local.example) แล้วกรอกให้ครบ 4 ค่า:

| ตัวแปร | เอาค่ามาจากไหน |
|---|---|
| `SUPABASE_URL` | Supabase Dashboard → Project Settings → Data API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Project Settings → API Keys → `service_role` (กด Reveal) |
| `SESSION_SECRET` | สุ่มเองยาวอย่างน้อย 32 ตัวอักษร ใช้สำหรับเซ็นคุกกี้ session |
| `APP_SECURE_COOKIES` | `false` ถ้าเข้าผ่าน `http://` · `true` เมื่อย้ายไป `https://` แล้วเท่านั้น |

```bash
npm run dev     # เปิดที่ http://localhost:3000
npm run build   # ตรวจว่า build ผ่านก่อนนำขึ้นใช้จริง
npm run lint
npx tsc --noEmit
```

> ⚠️ **`APP_SECURE_COOKIES` ต้องเป็น `false` ถ้าเสิร์ฟผ่าน http** ไม่งั้นเบราว์เซอร์จะไม่ยอมเก็บคุกกี้
> ผลคือ login สำเร็จแต่เด้งกลับหน้าเดิมวนไม่รู้จบ — และบั๊กนี้**ไม่โผล่ตอน `npm run dev`** จะเจอตอน build เท่านั้น

---

## นำขึ้นใช้งานจริงบน Vercel

1. push โค้ดขึ้น GitHub (repo **private** — ในเอกสารมีรายละเอียดภายในขององค์กรและชื่อผู้ใช้จริง)
2. ที่ Vercel: **Add New → Project → Import** repo นี้ (Framework Preset จะถูกตรวจเป็น Next.js อัตโนมัติ ไม่ต้องตั้งค่า build เอง)
3. **ใส่ Environment Variables ให้ครบ 4 ตัวก่อนกด Deploy** (Settings → Environment Variables) — ค่าเหมือนใน `.env.local` ยกเว้นข้อสุดท้าย:

| ตัวแปร | ค่าที่ใช้บน Vercel |
|---|---|
| `SUPABASE_URL` | เหมือนเดิม |
| `SUPABASE_SERVICE_ROLE_KEY` | เหมือนเดิม — **ห้ามใส่ `NEXT_PUBLIC_` นำหน้าเด็ดขาด** |
| `SESSION_SECRET` | เหมือนเดิม (ถ้าเปลี่ยนค่า ทุกคนที่ login ค้างอยู่จะหลุดทันที) |
| `APP_SECURE_COOKIES` | **`true`** — Vercel เสิร์ฟผ่าน https เสมอ |

### ⚠️ ก่อนส่งลิงก์ให้คนอื่นทดลองใช้ ต้องทำ 2 อย่างนี้ก่อน

1. **เปลี่ยนรหัสผ่านทุกบัญชีที่ยังเป็นรหัสทดสอบ** — URL ของ Vercel เปิดให้ทุกคนบนอินเทอร์เน็ตเข้าถึงได้
   ระบบนี้ใช้ username/password ของตัวเอง ไม่มีด่านอื่นกั้น ใครเดารหัสถูกก็เข้าได้ทันที (บัญชี admin เข้าถึงได้ทุกอย่างรวมถึงถังขยะ)
2. **ตัดสินใจเรื่องข้อมูลในระบบ** — ตอนนี้เป็นข้อมูลสมมติ ถ้าจะให้คนนอกทีมลองใช้ ควรคงเป็นข้อมูลสมมติไว้ก่อน
   (ถ้าอยากจำกัดคนเข้าถึงชั่วคราว Vercel มี **Deployment Protection → Password Protection** ในแผน Pro)

---

## ฐานข้อมูล (Supabase)

โครงสร้างและคำสั่งทั้งหมดเก็บเป็นไฟล์อยู่ใน [`supabase/migrations/`](supabase/migrations/) เรียงตามลำดับเลข

| ไฟล์ | เนื้อหา |
|---|---|
| `0001_baseline_schema.sql` | ตาราง 4 ตัว (`users`, `meetings`, `tasks`, `board_posts`) + enum + index + เปิด RLS |
| `0002_baseline_functions.sql` | ฟังก์ชันทั้ง 42 ตัว (สำเนาจุดตั้งต้น ณ 2026-09-15) |
| `0003_fix_missing_auth_checks.sql` | ปิดช่องที่บันทึกส่วนตัวในถังขยะรั่ว + เติมการตรวจสิทธิ์ให้ `set_own_avatar` |
| `0004_lockdown_rpc_grants.sql` | ตัดสิทธิ์ `anon` / `authenticated` ออกจากทุกฟังก์ชัน เหลือเฉพาะ `service_role` |
| `0005_task_owner_inspector_ids.sql` | เปลี่ยนผู้รับผิดชอบ/ผู้ตรวจจาก "ชื่อ" เป็น `owner_id`/`inspector_id` (FK → users) + ย้ายข้อมูลเดิมทั้งหมด |
| `0006_drop_legacy_owner_inspector_columns.sql` | ลบคอลัมน์ `owner`/`inspector` (text) เดิมทิ้ง |
| `0007_wall_unread_and_drop_private.sql` | The Wall: เพิ่ม `seen_by` (ใช้ทำ Red Badge "ยังไม่ได้อ่าน") + ลบคอลัมน์ `is_private` และฟีเจอร์ Private Memo ทิ้ง |
| `0008_drop_dead_functions.sql` | ลบฟังก์ชันที่ถูกแทนที่ไปแล้วแต่ยังค้างในฐานข้อมูล 4 ตัว (`admin_rename_user`, `admin_reorder_user`, `admin_update_roles`, `update_meeting`) |

**กฎเหล็ก:** ทุกการเปลี่ยนแปลงฐานข้อมูล **ต้องเขียนเป็นไฟล์ `.sql` ใหม่ในโฟลเดอร์นี้เสมอ**
ห้ามแก้ผ่าน Supabase Dashboard แล้วไม่มีไฟล์ — เพราะจะไม่มีใครตรวจทานได้ ย้อนกลับไม่ได้ และเคยเป็นสาเหตุที่ช่องโหว่ระดับยึดระบบหลุดรอดมาได้ทุก Phase

### สถาปัตยกรรมด้านความปลอดภัย

```
เบราว์เซอร์ ──► Next.js Server Action ──► Supabase (service_role) ──► ฟังก์ชัน SECURITY DEFINER ──► ตาราง
                       ▲                                                        ▲
              อ่านตัวตนจากคุกกี้ JWT                            ตาราง: RLS เปิด + ไม่มี policy
              ที่เซ็นด้วย SESSION_SECRET                        = ห้ามแตะตารางตรง ๆ ทุกกรณี
```

- ฐานข้อมูล **เข้าถึงได้จากฝั่งเซิร์ฟเวอร์เท่านั้น** — ไม่มีคีย์ใดถูกส่งไปกับหน้าเว็บ (ห้ามใช้ `NEXT_PUBLIC_` กับคีย์ Supabase เด็ดขาด)
- `service_role` **ข้ามด่านตรวจทุกอย่างของฐานข้อมูล** ดังนั้น **ทุก Server Action ต้องตรวจสิทธิ์ผู้ใช้เองก่อนเสมอ** (ดู `getSession()` ใน `src/lib/auth.ts` และ `requireAdmin()` ใน `src/app/admin/users/actions.ts`)
- `src/lib/supabase.ts` มี `import "server-only"` — build จะพังทันทีถ้ามีไฟล์ฝั่ง client เผลอ import เข้ามา
- ตารางเปิด RLS โดย**ไม่มี policy โดยตั้งใจ** = ปิดการเข้าถึงตารางตรง ๆ ทั้งหมด ทุกอย่างต้องผ่านฟังก์ชันเท่านั้น
  (Supabase advisor จะขึ้น INFO `rls_enabled_no_policy` ซึ่งถูกต้องแล้วสำหรับการออกแบบนี้ ไม่ต้องแก้)

### บทบาทผู้ใช้

| Role | ทำอะไรได้ |
|---|---|
| `admin` | จัดการผู้ใช้ · เห็นถังขยะ · จัดลำดับ Dashboard |
| `owner` | ถูกเลือกเป็นผู้รับผิดชอบวาระได้ |
| `inspector` | ถูกเลือกเป็นผู้ตรวจได้ (จำกัดกลุ่มตรวจได้ที่ `review_groups`) |

`can_manage_tasks` เป็นสิทธิ์แยกต่างหากจาก role ใช้ควบคุมการสร้าง/แก้ไข/ลบวาระ
