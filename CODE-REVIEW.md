# CODE REVIEW — Workload Tracker

ผู้ตรวจ: Senior Engineer review · วันที่ 2026-09-15
ขอบเขต: `src/**` ทั้งหมด (40 ไฟล์ / ~5,748 บรรทัด) + ตรวจสอบ schema และ functions บน Supabase project `kalooxclwbnjunuxbjst` ของจริง

> **สรุปหนึ่งบรรทัด:** โค้ดฝั่ง UI เขียนได้สะอาดเกินคาดสำหรับงานที่ AI generate (ตั้งชื่อดี, comment ภาษาไทยอธิบาย "ทำไม" ได้จริง, `tsc --noEmit` ผ่าน 0 error) **แต่ชั้น security พังทั้งชั้น** — ตอนนี้ใครก็ตามที่เข้าถึงเว็บได้ สามารถยึดบัญชี admin ได้ภายใน 3 HTTP request โดยไม่ต้อง login เลย นี่คือสิ่งที่ต้องแก้ก่อนทุกอย่าง

---

## 0. สิ่งที่ทำได้ดี (ให้เครดิตก่อน)

| เรื่อง | รายละเอียด |
|---|---|
| Optimistic concurrency | มี `version` column + `version_conflict` ครบทุก mutation — หายากมากในโค้ดที่ AI generate |
| Soft delete + Trash | ออกแบบครบวงจร (archive / restore / delete forever) ตรงตาม PRODUCT.md ข้อ 6 |
| Comment อธิบาย "ทำไม" | เช่น `board-types.ts:1-2` อธิบายว่าทำไมไม่ใช้ `crypto.randomUUID()` — comment ระดับนี้คือสิ่งที่ reviewer อยากเห็น |
| แยก pure function ออกมา | `board-derived.ts` แยก business logic ออกจาก component ได้สะอาด และพร้อมเขียน test ทันที |
| Design token | `globals.css` ใช้ CSS variable + `@theme inline` มี dark mode ครบทุก token ไม่มีสี hardcode |
| Theme init script | `layout.tsx:23-32` ใส่ script `beforeInteractive` กัน FOUC ถูกต้องตามตำรา |

---

# 1. บั๊กและข้อผิดพลาด

## CRITICAL — ช่องโหว่ระดับยึดระบบ (ยืนยันจากฐานข้อมูลจริงแล้ว)

### S1. ผู้ที่ไม่ได้ login สามารถ reset password ของ admin แล้วยึดระบบได้

นี่ไม่ใช่ข้อสงสัย — ผม query `pg_proc` บน project จริงแล้ว ผลคือ:

- **ทั้ง 42 RPC functions** เป็น `SECURITY DEFINER` และ **`GRANT EXECUTE` ให้ role `anon` ทุกตัว** (Supabase advisor ยืนยัน: lint `anon_security_definer_function_executable` จำนวน 42 รายการ)
- `anon key` ถูก prefix ว่า `NEXT_PUBLIC_` → **ถูกฝังอยู่ใน JavaScript bundle ที่ส่งให้ browser ทุกคน** เปิด DevTools ก็เห็น
- ตัวตนของผู้เรียกถูกส่งมาเป็น **parameter** (`p_admin_id`, `p_user_id`) ไม่ใช่ principal ที่ระบบ authenticate เอง → **เท่ากับให้ผู้โจมตีกรอกเองว่า "ฉันคือ admin"**

**ขั้นตอนโจมตี (3 requests ไม่ต้อง login):**

```
1. POST /rest/v1/rpc/list_all_users
   → ได้ UUID ของทุกคนในระบบ (ฟังก์ชันนี้ไม่มี auth check เลยแม้แต่บรรทัดเดียว)

2. POST /rest/v1/rpc/admin_list_users  {p_admin_id: <ลองทีละ uuid>}
   → uuid ไหนไม่ error = uuid นั้นคือ admin (ใช้เป็น oracle)

3. POST /rest/v1/rpc/admin_reset_password
   {p_admin_id: <admin uuid>, p_target_user_id: <admin uuid>, p_new_password: "hacked"}
   → login เป็น admin ได้ทันที
```

ยืนยันจาก source จริงของ `admin_reset_password`:

```sql
if not exists (select 1 from users u where u.id = p_admin_id and 'admin' = any(u.roles)) then
  raise exception 'unauthorized';
end if;
```

ฟังก์ชันเช็คว่า "uuid นี้เป็น admin ไหม" ถูกต้อง แต่ **ไม่เคยเช็คว่าผู้เรียกเป็นเจ้าของ uuid นั้นจริงหรือเปล่า** และ `list_all_users()` ก็แจก uuid ให้ฟรี ๆ อยู่แล้ว

**ผลกระทบเพิ่มเติม (ไม่ต้อง login เช่นกัน):**

- `list_active_tasks()`, `list_meetings()`, `list_deleted_tasks()` → อ่านงานทั้งองค์กรได้หมด
- `list_deleted_board_posts()` → อ่าน memo ที่ตั้งเป็น **Private** ของทุกคนได้ (ดู S4)
- `admin_create_user` → สร้าง admin ใหม่ให้ตัวเอง
- `admin_delete_user`, `delete_task_forever`, `delete_meeting_forever` → ลบข้อมูลถาวรทั้งระบบ

> RLS เปิดอยู่ครบทั้ง 4 ตาราง (ดีแล้ว) แต่ **ไม่ช่วยอะไรเลย** เพราะ `SECURITY DEFINER` bypass RLS โดยนิยาม

**หมายเหตุ:** ผมไม่ได้ทดลอง exploit จริงกับ production — สรุปจาก source ของฟังก์ชัน, grant matrix และ Supabase advisor เท่านั้น แต่หลักฐานทั้ง 3 ทางตรงกันหมด

---

### S2. `set_own_avatar` ไม่มี auth check แม้แต่บรรทัดเดียว

```sql
CREATE FUNCTION set_own_avatar(p_user_id uuid, p_avatar_variant integer)
-- ตรวจแค่ว่า variant อยู่ในช่วง 0-9 แล้ว update users set avatar_variant = ... where id = p_user_id
```

ชื่อบอกว่า "own" แต่ไม่มีอะไรบังคับว่าต้องเป็น own จริง ๆ — ใครก็เปลี่ยน avatar ให้ใครก็ได้ เป็นหลักฐานว่า pattern "เอา id มาเป็น parameter" ถูกใช้ต่อ ๆ กันมาโดยไม่มีใครตั้งคำถามตลอดทั้งโปรเจกต์

### S3. Session ไม่สะท้อนสถานะจริงของผู้ใช้ (JWT อายุ 7 วัน)

`src/lib/session.ts:13` ตั้ง `SESSION_DURATION_SECONDS` = 7 วัน และ **ยัด `roles` ลงไปใน JWT** ส่วน `middleware.ts:26` ตรวจสิทธิ์ admin จาก JWT payload อย่างเดียว ผลคือ:

- **ลบ user ทิ้งแล้ว user คนนั้นยังใช้ระบบต่อได้อีก 7 วัน** (cookie ยัง valid, signature ยังถูกต้อง)
- **ถอนสิทธิ์ admin แล้วเขายังเข้า `/admin/users` ได้จนกว่า token จะหมดอายุ**
- ไม่มีทาง revoke session ใครได้เลย ไม่มี logout-all ไม่มี token version

น่าสังเกตว่า `can_manage_tasks` กลับอ่านสดจาก DB ทุกครั้ง (`get_own_permissions`) แสดงว่า "รู้อยู่แล้ว" ว่าควรอ่านสด แต่ไม่ได้ทำแบบเดียวกันกับ `roles`

### S4. `list_deleted_board_posts()` คืน memo ส่วนตัวของทุกคน

`list_board_posts` กรอง private ไว้ถูกต้อง:

```sql
and (bp.is_private = false or bp.author_id = p_user_id or p_user_id = any(bp.tagged_user_ids))
```

แต่ `list_deleted_board_posts` **ไม่รับ `p_user_id` เลยและไม่กรองอะไรทั้งสิ้น** ขณะที่ `page.tsx:137` ดึงมาให้ทุกคนตั้งแต่โหลดหน้าแรก (แม้ไม่ใช่ admin ก็โหลดลง client) แล้ว `AppShell` ค่อยซ่อน UI ด้วย `isAdmin` — **ซ่อนที่ UI แต่ข้อมูลหลุดไปถึง browser เรียบร้อยแล้ว** เปิด React DevTools ก็อ่านได้

### S5. `login` ไม่มี rate limit / lockout

`loginAction` ยิง `rpc("login")` ตรง ๆ ไม่มีการนับครั้งที่ผิด ไม่มี delay ไม่มี CAPTCHA และเพราะ `anon` เรียก RPC ได้ตรง ๆ อยู่แล้ว (S1) ผู้โจมตีไม่ต้องผ่าน Next.js ด้วยซ้ำ — ยิง brute force เข้า Supabase ตรง ๆ ได้เต็มความเร็ว

### S6. Cookie `secure: true` บนระบบที่รันผ่าน HTTP → login ไม่ติดเลยตอน production

```ts
// src/lib/auth.ts:17
secure: process.env.NODE_ENV === "production",
```

แต่ระบบนี้เข้าผ่าน **LAN IP ธรรมดา** (ยืนยัน 2 จุด: `next.config.ts` มี `allowedDevOrigins: ["192.168.1.186"]` และ comment ใน `board-types.ts:1-2` ระบุว่า "accessed over plain HTTP via LAN IP")

ผลคือเมื่อ build จริง (`npm run build && npm start`) cookie จะถูก mark `Secure` → **browser ปฏิเสธการเก็บ cookie บน http://** → login สำเร็จแต่ถูก redirect กลับหน้า login วนไม่รู้จบ และจะหาสาเหตุยากมากเพราะ dev mode ปกติดี

### S7. `update_task_workflow` ให้ client เขียนทับ audit trail ได้ทั้งก้อน

```sql
if not exists (select 1 from users u where u.id = p_user_id) then raise exception 'unauthorized'; end if;
update tasks set status = p_status, inspector = p_inspector, history = coalesce(p_history,'[]'::jsonb) ...
```

เช็คแค่ "uuid นี้มีตัวตน" เท่านั้น → ใครก็ได้ในระบบ (หรือ anon ตาม S1) **ส่ง history อะไรก็ได้ไปทับของเดิม** ลบ log ว่าใครส่งตรวจ, ปลอมว่าใครตรวจแล้ว, ข้าม state machine ได้หมด ขัดกับ AGENTS.md ข้อ 1.6 "รักษาข้อมูล Workflow และ History ให้ถูกต้อง" โดยตรง — state machine ทั้งหมดอยู่ที่ client ส่วน server ไม่เคยตรวจว่า transition ถูกกฎหรือไม่

---

## Logic Bugs

### B1. `reopenTask` ทำให้ข้อมูลเพี้ยน เมื่อเคย "ส่งตรวจซ้ำ" (reproduce ได้จริง)

`AppShell.tsx:206-211` — เวลาส่งตรวจงานที่ `pending` อยู่แล้ว ระบบจะแอบเติม entry "ตรวจแล้ว" ของผู้ตรวจคนเดิมให้อัตโนมัติ:

```ts
function withSkippedReviewEntry(t: Task, history: HistoryEntry[]): HistoryEntry[] {
  if (t.status !== "pending") return history;
  return [...history, { action: "reviewed", inspector: t.inspector, ... }];   // entry ที่ 1
}
// จากนั้น runWorkflow เพิ่ม entry ของ "sent" ต่ออีก                            // entry ที่ 2
```

แต่ `reopenTask` (`AppShell.tsx:317`) ตัดออก **แค่ 1 entry**:

```ts
const history = task.history.slice(0, -1);
```

> **แก้ไขรายงาน (2026-09-15):** ฉบับแรกของเอกสารนี้เขียนขั้นตอน reproduce ผิด โดยระบุว่ากด "ย้อนสถานะ" ขณะสถานะเป็น `pending` ได้
> ซึ่ง **ทำไม่ได้** — `TaskRow.tsx:457` แสดงปุ่มย้อนสถานะเฉพาะตอน `task.status === "closed"` เท่านั้น (ผู้ใช้ท้วงติงและตรวจสอบแล้วว่าถูกต้อง)
> บั๊กนี้ยังมีอยู่จริง แต่ขอบเขตแคบกว่าที่รายงานไว้เดิมมาก — ด้านล่างคือฉบับที่ตรวจสอบแล้ว

**เส้นทางปกติทำงานถูกต้อง** — ยืนยันด้วยการจำลองตรรกะจริงของโค้ด:

| ฉาก | ผลลัพธ์ |
|---|---|
| ส่งตรวจ A → A ตรวจแล้ว → ปิดงาน → ย้อนสถานะ | ✅ ได้ `done` ("A แล้ว") ตรงกับสถานะก่อนปิดงาน |
| ปิดงานตั้งแต่ยังไม่เคยส่งตรวจ → ย้อนสถานะ | ✅ ได้ `blank` ถูกต้อง |

**เส้นทางที่พัง — กด "ปิดงาน" ขณะงานยังส่งตรวจค้างอยู่** (ปุ่มปิดงานไม่มี `disabled` จึงกดได้ทุกสถานะ):

| # | การกระทำ | history | status |
|---|---|---|---|
| 1 | ส่งตรวจ → A | `[sent→A]` | pending |
| 2 | กดปิดงาน (A ยังไม่ได้ตรวจ) | `[sent→A, reviewed by A ←ระบบเติมเอง, closed]` | closed |
| 3 | กด "ย้อนสถานะ" | `[sent→A, reviewed by A ←ค้างถาวร]` | **done** ผิด |

ขั้นที่ 3 ควรกลับไปเป็น `pending` (รอ A ตรวจ) ตามสถานะก่อนปิดงาน แต่กลับได้ `done` เพราะ `withSkippedReviewEntry` เติม entry ให้ตอนปิดงาน (2 entries) ส่วน `reopenTask` ถอดออกแค่ 1

**ผลเสีย:** สถานะหลังย้อนกลับไม่ตรงกับสถานะก่อนปิดงาน (เพี้ยนไป 1 ขั้น) และผู้ใช้ไม่มีโอกาสบอกว่าตกลง A ตรวจหรือยัง

**วิธีแก้ที่แนะนำ — แก้ที่ U20 จุดเดียวพอ:** เมื่อเปลี่ยนไป "ถามผู้ใช้ก่อนแล้วค่อยเขียน record"
จำนวน entry ที่เพิ่มจะขึ้นกับคำตอบของผู้ใช้ และตรงกับที่ `reopenTask` ถอดออกพอดีทั้งสองทาง (ทดสอบด้วยการจำลองตรรกะจริงแล้ว):

| ผู้ใช้ตอบตอนกดปิดงาน | Timeline | ย้อนสถานะแล้วได้ | ถูกต้องไหม |
|---|---|---|---|
| "A ตรวจแล้ว (นอกระบบ)" | `ส่งตรวจ A` · `A ตรวจแล้ว (บันทึกย้อนหลัง)` | **"A แล้ว"** | ✅ ตรงกับที่บันทึกไว้ |
| "A ยังไม่ได้ตรวจ" | `ส่งตรวจ A` | **"ส่ง A"** | ✅ กลับไปรอ A ตรวจ |

→ **ไม่ต้องเพิ่มฟิลด์ `prevStatus` / `prevInspector` ตามที่เสนอไว้ในข้อ 4.3 อีกต่อไป** และไม่ต้องแตะ `reopenTask` เลย
(ข้อเสนอ 4.3 เดิมตั้งอยู่บนสมมติฐานว่าระบบต้องเขียน entry ให้เองเสมอ ซึ่งไม่ใช่แล้ว)

### B2. สถานะถูก "เดา" จาก log ตัวสุดท้าย แทนที่จะเป็น state machine จริง

```ts
const doneActions: HistoryAction[] = ["reviewed", "reopened", "closed"];
const status = !lastEntry ? "blank" : doneActions.includes(lastEntry.action) ? "done" : ...
```

ปัญหา: (ก) `"closed"` ถูก map เป็น `"done"` ซึ่งบังเอิญถูกในเคสเดียว แต่เป็น mapping ที่อ่านแล้วไม่เข้าใจเจตนา (ข) **`action: "reopened"` ไม่มี code path ไหนใน "โค้ดปัจจุบัน" สร้างมันขึ้นมา**
> **แก้ไขรายงาน (2026-09-15):** ฉบับแรกสรุปว่าเป็น dead code ลบทิ้งได้ — **ผิด** ตรวจข้อมูลจริงแล้วพบว่ามีบรรทัด `โบ > ย้อนสถานะ` อยู่ในประวัติงานจริง (เขียนโดยโค้ดรุ่นเก่า)
> ดังนั้น `case "reopened"` ใน `historyLabel()` **ห้ามลบ** ไม่งั้นประวัติเก่าจะแสดงผลไม่ได้ (ค) การ reverse-engineer state จาก log ทำให้ทุกครั้งที่เพิ่ม action ใหม่ ต้องกลับมาแก้ตรงนี้ และจะลืมแน่นอน

### B3. Version conflict = ทางตัน ผู้ใช้ต้อง refresh เองและเสียงานที่พิมพ์ค้างไว้

`version` ที่ส่งไปมาจาก local state เท่านั้น ซึ่งไม่เคย sync กับ server อีกเลยหลัง mount (ดู P1) → พอมีคนที่สองแก้งานเดียวกัน คนแรกจะเจอ "ข้อมูลนี้มีการอัปเดตแล้ว กรุณา Refresh" **ตลอดไปจนกว่าจะ reload เอง** ทุกครั้งที่กดปุ่มใดก็ตามบนงานนั้น และ banner ก็ไม่ได้ refresh ให้ แค่บอกให้ไปกดเอง (ซึ่งทำให้ข้อความที่พิมพ์ค้างใน modal หายหมด)

### B4. `task.owner` ในตารางแสดง pill ว่างเปล่า ไม่ใช่ `EMPTY_MARK`

`TaskRow.tsx:370` เขียน `{task.owner}` ตรง ๆ ทั้งที่ `owner` เป็น optional — งานที่ยังไม่กำหนดผู้รับผิดชอบจะโชว์ pill สีเทาเปล่า ๆ ขณะที่คอลัมน์อื่นในแถวเดียวกันโชว์ `–` ตามระบบ `EMPTY_MARK` ที่อุตส่าห์ออกแบบไว้ (`board-derived.ts:4`)

### B5. ใช้ `displayName` เป็น identity แทน `id` ทั้งระบบ — ข้อบกพร่องเชิง data model ที่ใหญ่ที่สุด

> **✅ แก้แล้ว 2026-09-15** — ดู `supabase/migrations/0005_task_owner_inspector_ids.sql` และสรุปใน `FIX-INSTRUCTIONS.md` Phase G
> ทดสอบจริงแล้ว: เปลี่ยนชื่อผู้ใช้ → งานยังอยู่กับเขาครบ และชื่อใหม่ขึ้นทุกที่ทันที

`tasks.owner` และ `tasks.inspector` เก็บเป็น **ข้อความชื่อ** ไม่ใช่ foreign key:

```ts
taskNeedsMyAction(task, displayName)                        // เทียบด้วยชื่อ
tasks.filter(t => t.inspector === person.displayName)       // เทียบด้วยชื่อ
new Map(people.map(p => [p.displayName, p]))                // key ด้วยชื่อ
```

ผลที่ตามมา:

1. **admin แก้ "ชื่อที่แสดง" ของใครสักคน → งานเก่าทั้งหมดของคนนั้นขาดจากเขาทันที** "งานของฉัน" ว่างเปล่า, dashboard นับเป็น 0, badge หายหมด และ `taskSteps()` จะสร้าง step ของชื่อเก่าค้างไว้ตลอดกาล เพราะ history เก็บชื่อไว้ (`board-derived.ts:41-44`)
2. **คนที่ชื่อซ้ำกันจะถูกยุบเป็นคนเดียว** — `workloadSummary` ใช้ `new Map(...[p.displayName, p])` ซึ่ง de-dupe ด้วยชื่อ คนที่ 2 หายจาก dashboard เงียบ ๆ
3. `admin_delete_user` ลบ user ทิ้ง แต่ `tasks.owner` ยังค้างเป็นชื่อของคนที่ไม่มีตัวตนแล้ว — ไม่มีใครเห็น ไม่มีใครรับผิดชอบ

ที่น่าสังเกตคือ **ระบบรู้จัก id ดีอยู่แล้ว** (`Person.id`, `taggedUserIds` ของ board post ใช้ uuid ถูกต้อง) แต่ฝั่ง task กลับใช้ชื่อ — ไม่สม่ำเสมอกันเองภายในโปรเจกต์เดียว

### B6. Badge สีแดงบน "The Wall" เป็นตัวนับสะสม ไม่มีวันเป็นศูนย์

```ts
const myBoardPosts = boardPosts.filter(p => boardPostRelevantToMe(p, user.id));  // โพสต์ของฉัน + ที่ tag ฉัน
{myBoardPosts.length > 0 && <span className="...bg-pending...">{myBoardPosts.length}</span>}
```

Badge สีแดงสื่อว่า "มีของใหม่ต้องดู" แต่ตัวเลขนี้คือ "จำนวน memo ทั้งหมดที่เกี่ยวกับฉันตั้งแต่เปิดระบบ" → **ยิ่งใช้ยิ่งเพิ่ม กดอ่านแล้วก็ไม่ลด** สุดท้ายผู้ใช้จะเรียนรู้ที่จะเมิน badge (alert fatigue) ต้องมี `last_seen_at` ถึงจะนับ unread ได้จริง

### B7. `showToast` ทิ้ง timer ค้างไว้

```ts
function showToast(message: string) {
  setToast(message);
  setTimeout(() => setToast(c => c === message ? null : c), 2500);  // ไม่เคย clearTimeout
}
```

ไม่ clear ตอน unmount และเมื่อ toast ซ้อนกันจะเขียนทับกันเงียบ ๆ (toast ที่ 2 มาแทนที่ toast ที่ 1 แต่ timer ของตัวแรกยังนับต่อ)

### B8. สร้างประชุมจาก template = ยิงทีละ request, ล้มกลางคันแล้วเงียบ

```ts
for (const title of templateTaskTitles) {
  const taskResult = await createTaskAction({ meetingId: newMeetingId, title, urgent: false });
  if (taskResult.ok) { setMeetings(...) }     // ถ้า !ok ไม่ทำอะไรเลย ไม่แจ้งผู้ใช้
}
```

template 10 เรื่อง = 10 round trip เรียงต่อกัน (แต่ละอันยัง `revalidatePath("/")` อีก ดู P1) ถ้าอันที่ 6 พัง ผู้ใช้จะได้ประชุมที่มี 5 วาระ **โดยไม่มีอะไรบอก** และไม่มี transaction ให้ rollback

### B9. `page.tsx` return `null` ตอนไม่มี session → จอขาวเปล่า

```ts
const user = await getSession();
if (!user) return null;      // ควรเป็น redirect("/login")
```

ตอนนี้รอดเพราะ middleware ดักไว้ แต่วันไหน matcher เปลี่ยน หรือ `SESSION_SECRET` ถูก rotate ผู้ใช้จะเจอ **หน้าขาว ๆ ไม่มี error ไม่มีทางออก** ซึ่งเป็น failure mode ที่แย่ที่สุดแบบหนึ่ง

### B10. `/admin/users` ไม่ตรวจสิทธิ์ในหน้าเอง

```ts
const admin = await getSession();               // ไม่เช็ค roles.includes("admin")
const { data: users } = await supabase.rpc("admin_list_users", { p_admin_id: admin?.id });
```

`admin?.id` เป็น `undefined` ได้ด้วยซ้ำ ที่รอดเพราะ DB raise `unauthorized` → แต่ error ถูกทิ้ง (destructure เอาแค่ `data`) → คนที่ไม่ใช่ admin จะเห็น **หน้าจัดการผู้ใช้เปล่า ๆ พร้อมปุ่ม "เพิ่มผู้ใช้งาน"** แทนที่จะโดน redirect ซึ่งสับสนและดูเหมือนข้อมูลหาย

### B11. มี `update_task_details` ซ้อนกัน 2 overload ใน DB (ระเบิดเวลา)

DB มีทั้งเวอร์ชัน 10 args (ของเก่า) และ 11 args (`p_excluded_auto_steps text[] DEFAULT NULL`) ตอนนี้แอปเรียกแบบ 11 args เลยยังไม่พัง แต่ถ้าวันไหนมีใครเรียกด้วย 10 args → PostgREST เลือก candidate ไม่ได้ ตอบ **PGRST203 "Could not choose the best candidate function"** เป็นเศษซากจาก migration ที่ไม่ได้ลบทิ้ง (พร้อมกับ `admin_rename_user`, `admin_reorder_user`, `admin_update_roles`, `update_meeting` ที่ไม่มีใครเรียกแล้ว)

### B12. ฟังก์ชันวันที่/เวลาใช้ timezone ของเครื่อง → hydration mismatch และวันเพี้ยน

```ts
const target = new Date(`${reminderDate}T00:00:00`);   // ตีความเป็น local time ของเครื่องที่รัน
const diffMs = Date.now() - new Date(iso).getTime();   // formatRelativeTime ซึ่งถูก render บน server ด้วย
```

Server (UTC ถ้า deploy ขึ้น cloud) กับ client (UTC+7) จะได้ "วันนี้" คนละวัน → badge "ใกล้ถึงกำหนด" คลาดเคลื่อน 1 วัน และ `formatRelativeTime` คำนวณจาก `Date.now()` ตอน render ทำให้ HTML จาก server กับ client ไม่ตรงกัน = hydration mismatch (ซึ่งน่าจะเป็นเหตุผลจริงที่ต้องโปะ `suppressHydrationWarning` ไว้หลายจุด ดู C12)

### B13. `historyLabel` ไม่มี `default` — audit entry แปลกปลอมจะหายเงียบ

switch ครบ 4 case ตาม type แต่ `history` มาจาก DB ผ่าน cast (`as HistoryEntry[]` ไม่ validate) ถ้ามี action อื่นหลุดเข้ามา (เช่นจาก S7 หรือข้อมูลเก่า) → return `undefined` → React render ว่างเปล่า → **log หายไปจากหน้าจอโดยไม่มี error ใด ๆ**

### B14. `AvatarFace` กับค่าติดลบ/NaN → avatar ว่าง

`FACES[variant % FACES.length]` ถ้า `avatar_variant` เป็นค่าลบหรือ NaN จะได้ `undefined` (DB บล็อกช่วง 0-9 ไว้แล้ว แต่ข้อมูลที่เขียนก่อนหน้านั้นไม่เคยถูกตรวจ)

### B15. Component ไม่รับ props ใหม่ (stale state) — และไม่สม่ำเสมอกันเอง

`AppShell`, `WorkloadDashboard`, `TaskRow` ทั้งหมด seed `useState(props)` ครั้งเดียวแล้วไม่เคยรับค่าใหม่อีกเลย ขณะที่ `UserList.tsx:23-29` **ทำ pattern reset ไว้ถูกต้อง**:

```ts
const [prevInitialUsers, setPrevInitialUsers] = useState(initialUsers);
if (initialUsers !== prevInitialUsers) { setPrevInitialUsers(initialUsers); setUsers(initialUsers); }
```

แปลว่า "รู้วิธี" แต่ทำแค่ไฟล์เดียว — ความไม่สม่ำเสมอแบบนี้แหละที่ทำให้ P1 กลายเป็นปัญหาใหญ่

### B16. บันทึกลำดับแบบ fire-and-forget ไม่มี rollback

```ts
const [, startTransition] = useTransition();     // ทิ้ง isPending ไปเฉย ๆ
startTransition(() => { setDashboardOrderAction(next.map(p => p.id)); });   // ไม่ await ไม่เช็ค error
```

ถ้าบันทึกล้มเหลว UI แสดงลำดับใหม่ ส่วน DB เก็บลำดับเก่า ผู้ใช้จะรู้ตอน reload วันถัดไป และ `startTransition` ที่ครอบ async function โดยไม่ await **ไม่ได้ทำอะไรเลย** — `isPending` ไม่มีทางเป็น true เพราะ callback จบทันที (ปัญหาเดียวกันที่ `UserList.tsx:46`)

---

# 2. ประสิทธิภาพ (Performance)

### P1. ทุก mutation ยิง query 10 ตัวใหม่ทั้งหน้า แล้วโยนผลทิ้ง (จุดที่ได้กำไรมากที่สุด)

ทุก server action จบด้วย `revalidatePath("/")` → Next.js re-render `page.tsx` → ยิง RPC **10 ตัวพร้อมกัน** (`list_meetings`, `list_active_tasks`, `list_deleted_tasks`, `list_board_posts`, `list_deleted_board_posts`, `list_all_users`, `list_workload_people`, `list_users_by_role` 2 ครั้ง, `get_own_permissions`) → ส่ง props ชุดใหม่ให้ `AppShell`

**แต่ `AppShell` เก็บทุกอย่างไว้ใน `useState(initialX)` ซึ่งเมิน props ใหม่ทั้งหมด (B15) → ข้อมูลที่เพิ่งดึงมาถูกทิ้งทันที**

แปลว่า: ติ๊ก checklist 1 ช่อง = สแกน 4 ตาราง + ส่ง payload ทั้งองค์กรข้ามเน็ตเวิร์ก **เพื่อไม่ได้ใช้อะไรเลย** ทางเลือกในการแก้:

- **(ก) เร็วที่สุด:** ลบ `revalidatePath("/")` ออกจาก action ที่ client apply ผลลัพธ์เองอยู่แล้ว (ซึ่งคือเกือบทั้งหมด) — ลดภาระ DB ทันทีโดยไม่กระทบ UX เลย
- **(ข) ถูกต้องกว่า:** เก็บ `revalidatePath` ไว้ แล้วทำให้ `AppShell` รับ props ใหม่จริง ๆ ตาม pattern ใน `UserList` → ได้ multi-user sync มาฟรี และแก้ B3 ไปในตัว

### P2. คำนวณใหม่ทั้งหมดทุก render โดยไม่มี `useMemo` เลยสักตัว

`AppShell` คำนวณสิ่งเหล่านี้ใหม่ **ทุกครั้งที่ state ใดก็ตามเปลี่ยน** รวมถึงตอนกดเปิด avatar picker หรือตอน toast โผล่:

```ts
const myTaskEntries = [...activeMeetings.flatMap(...)]        // วนทุก meeting × ทุก task
const mainTabNotifications = { board: myNotificationCount(boardMeetings.flatMap(m => m.tasks)), ... }  // 3 ชุด
const subTabNotifications = { resume: ..., draft: ..., conduct: ... }                                   // อีก 3 ชุด
```

รวมแล้ว **วนทุก task ในระบบอย่างน้อย 7 รอบต่อ 1 render** ส่วน `WorkloadDashboard` เรียก `workloadSummary` + `workloadMatrix` (O(คน × งาน × 7 คอลัมน์)) ใหม่ทุกเฟรมระหว่างลาก drag

### P3. ไม่มี `React.memo` และ callback ไม่ stable → 100 แถวรีเรนเดอร์พร้อมกัน

> **แก้ไขรายงาน (2026-09-15): ข้อเสนอนี้ยกเลิก** — ลองทำจริงแล้ว `useCallback`/`memo()` ด้วยมือทำให้ lint ขึ้น
> `Compilation Skipped: Existing memoization could not be preserved` 6 รายการ (กฎจาก React Compiler ใน eslint-plugin-react-hooks v7)
> ทางที่ถูกสำหรับโปรเจกต์นี้คือ **เปิด React Compiler** แล้วปล่อยให้ memo อัตโนมัติ ไม่ใช่เขียนเอง

handler ทั้ง 8 ตัวถูกสร้างใหม่ทุก render แล้วส่งลงไปยัง `TaskRow` ทุกตัว → toast เด้ง 1 ครั้ง = รีเรนเดอร์ทุกแถวในทุกประชุม

### P4. `taskSteps()` ถูกเรียก 3 รอบต่อ 1 TaskRow

```ts
const steps = taskSteps(task, inspectors);
const progress = taskProgress(task, inspectors);          // ข้างในเรียก taskSteps ซ้ำอีกรอบ
const allSteps = taskSteps({ ...task, excludedAutoSteps: [] }, inspectors);
```

แต่ละรอบสร้าง `Set` 2 ตัว + array ใหม่ ควรคำนวณครั้งเดียวแล้วส่งต่อ (`taskProgress(steps)`)

### P5. โหลดข้อมูลที่แทบไม่มีใครใช้ ทุกครั้งที่เปิดหน้าแรก

`list_deleted_tasks` + `list_deleted_board_posts` (หน้า Trash เฉพาะ admin เปิดนาน ๆ ครั้ง) และ `list_workload_people` (หน้า Dashboard) ถูกดึงมาพร้อมหน้าแรกเสมอสำหรับ **ทุกคน** ควรย้ายไปเป็น route แยกที่โหลดตอนเข้าใช้จริง

### P6. ค้นหา/อัปเดต task เป็น O(n) ทุกครั้ง

`findTaskById` วน `flatMap` ทุกประชุม ส่วน `applyTaskUpdate` สร้าง array ใหม่ของทุกประชุมและทุก task เพื่อแก้แถวเดียว — ถ้าเก็บ state แบบ normalize (`Record<taskId, Task>` โดยมี `meetingId` อยู่ใน task) จะแก้ทั้ง P2 / P3 / P6 พร้อมกัน

### P7. Bundle: `@dnd-kit` ทั้งก้อนถูกส่งให้ทุกคน

`AppShell` (client component 866 บรรทัด) import `TrashView`, `WorkloadDashboard`, `BoardView`, `MyTasksView` แบบ static ทั้งหมด → ผู้ใช้ทั่วไปที่ไม่เคยเปิด Dashboard ก็ต้องโหลด `@dnd-kit/core` + `sortable` + `utilities` ทุกครั้ง ควรใช้ `next/dynamic` กับ 4 หน้าจอรอง

---

# 3. ความสะอาดของโค้ด (Clean Code)

| # | ประเด็น | รายละเอียด |
|---|---|---|
| **C1** | `AppShell.tsx` = 866 บรรทัด | รวม 5 หน้าจอ + header + toast + conflict banner + 25 handler ไว้ใน function เดียว และใช้ `useState` เก็บหน้าจอแทน router → **ไม่มี deep link, กด Back = ออกจากแอป, refresh แล้วเด้งกลับหน้าแรก** ควรแยกเป็น route จริง |
| **C2** | Prop drilling 4 ชั้น | callback ชุดเดียวกัน 8 ตัวถูกประกาศ type ซ้ำเต็ม ๆ ใน `AppShell` → `MeetingCard` → `TaskTable` → `TaskRow` และซ้ำอีกรอบใน `MyTasksView` = **type เดียวกันเขียน 4 รอบ รวม ~80 บรรทัด** ยุบเป็น `type TaskActions = {...}` ตัวเดียวจบ |
| **C3** | Type และ mapper ก๊อปวาง | `MeetingRow`/`TaskRow`/`BoardPostRow` และ `mapTask`/`toTask`, `mapBoardPost`/`toBoardPost`, `toResult` **ซ้ำกันเป๊ะ ๆ** ระหว่าง `page.tsx`, `board-actions.ts`, `board-post-actions.ts` ควรมี `src/lib/mappers.ts` เจ้าเดียว (และ `TaskRow` เป็นชื่อทั้ง component และ DB type — สับสน) |
| **C4** | Boilerplate ซ้ำ 20 รอบ | ทุก action ใน `board-actions.ts` คือ 8 บรรทัดเดิม: `requireUser` → `getSupabaseClient` → `rpc` → `revalidatePath` → `toResult` มี helper ตัวเดียวลดจาก 309 เหลือ ~120 บรรทัด |
| **C5** | `requireUser()` หลอกลวง | ชื่อบอกว่า "require" (คาดว่าจะ throw) แต่แค่ `return await getSession()` — ทุก caller ต้องเช็ค null เองอยู่ดี |
| **C6** | `revalidatePath` ก่อนเช็ค error | ทุก action revalidate **ก่อน** ตรวจว่าสำเร็จหรือไม่ → ยิง refetch ทั้งหน้าทิ้งแม้ตอน operation ล้มเหลว (`avatar-actions.ts:15` และทุกตัวใน `board-actions.ts`) |
| **C7** | ไม่ validate input ฝั่ง server | `title`, `body`, `owner`, `taggedUserIds` ส่งตรงเข้า RPC ไม่เช็คความยาว/รูปแบบเลย (DB เช็คแค่ `title_required`) → memo ขนาด 10MB ก็เขียนได้ ควรใช้ zod หรือ guard ง่าย ๆ ที่ชั้น action |
| **C8** | Error ถูกกลืน ไม่มี log | `toResult` ใช้ `error.message.includes("version_conflict")` — **string matching กับข้อความ error** เปราะมาก และ error อื่นทั้งหมดกลายเป็น `"unknown"` โดย**ไม่มี `console.error` แม้แต่จุดเดียวในทั้งโปรเจกต์** → production พังแล้วไม่มีใครรู้ว่าพังเพราะอะไร |
| **C9** | Taxonomy เดียวกัน 4 แหล่ง | Board/Excom × Resume/Draft/Conduct ถูกประกาศซ้ำใน `AppShell` (`MAIN_TABS`, `SUB_TABS`, `MAIN_TAB_LABEL`, `SUB_TAB_LABEL`), `CreateMeetingForm` (`TAB_OPTIONS`, `SUB_TAB_OPTIONS`), `board-derived` (`WORKLOAD_MATRIX_COLUMNS`), `board-types` (`REVIEW_GROUPS`) — เพิ่ม sub-tab ใหม่ต้องแก้ 4 ที่ และ `OTHER_MEETING_TITLE` ประกาศทิ้งไว้ไม่มีใครใช้ |
| **C10** | Tailwind class ซ้ำจนเริ่มเพี้ยนแล้ว | `"inline-flex items-center justify-center rounded-lg border border-border p-2 text-text hover:border-accent hover:text-accent"` ถูกพิมพ์ซ้ำ 12+ ครั้ง และ **เริ่มไม่ตรงกันแล้ว** (ปุ่มใน `AppShell` vs `TrashView` vs `UserRow` มี hover/padding ต่างกันเล็กน้อย) ควรมี `<IconButton>`, `<Badge>`, `<Pill>` |
| **C11** | ภาษาปนกันใน UI เดียว | "The Wall", "My Memo", "No comments yet", "Posted by me", "just now" อยู่ข้าง "งานของฉัน", "ส่งตรวจ", "ปิดงาน" — comment บอกว่าตั้งใจ แต่ผู้ใช้จริงคือเจ้าหน้าที่ไทย ควรเลือกภาษาเดียวหรือทำ i18n จริงจัง |
| **C12** | `suppressHydrationWarning` โปะ 6 จุด | ใส่ทั้งใน `<form>` และ `<input>` ของ login / change-password / logout — เป็นการปิดปาก warning ไม่ใช่แก้ที่เหตุ และจะ **ซ่อน hydration bug ของจริงในอนาคต** (ดู B12 ที่น่าจะเป็นต้นเหตุ) |
| **C13** | มี 2 ระบบ confirm | `confirm()` native 7 จุด (ลบ task, ลบถาวร, archive, ลบ memo, ลบ comment, ลบ user) vs `<Modal>` custom สำหรับส่งตรวจ/ตรวจแล้ว — ไม่ consistent, `confirm()` block main thread, จัดสไตล์ไม่ได้, บนมือถือหน้าตาแล้วแต่ browser |
| **C14** | `generateId()` | `Date.now() + Math.random()` ถูกใช้เป็น **key จริงของ history/checklist** comment อธิบายเหตุผลไว้ดีแล้ว แต่ทางแก้ที่ถูกคือทำ HTTPS (ซึ่งต้องทำอยู่แล้วตาม S6) ไม่ใช่ลดคุณภาพของ ID |
| **C15** | Dead code | `HistoryAction "reopened"` ไม่มีที่สร้าง, DB function 4 ตัวไม่มีใครเรียก, `OTHER_MEETING_TITLE` ไม่ถูกใช้ |
| **C16** | **ไม่มี test เลยสักไฟล์** | 5,748 บรรทัด มี state machine 4 สถานะ + audit trail + optimistic locking แต่ไม่มี test เดียว ทั้งที่ `board-derived.ts` เป็น pure function ล้วน ๆ (`taskSteps`, `taskProgress`, `workloadSummary`, `reminderUrgency`, `formatShortDate`) เขียน test ได้ทันทีโดยไม่ต้อง mock อะไรเลย — และ B1 จะถูกจับได้ทันทีถ้ามี test ของ reopen |
| **C17** | **SQL ทั้งหมดไม่มีอยู่ใน repo** | ไม่มีโฟลเดอร์ `supabase/` ไม่มีไฟล์ `.sql` เลย → **business logic ทั้ง 42 ฟังก์ชันมีอยู่แค่ในระบบ production เท่านั้น** ไม่มี version control, review ไม่ได้, rollback ไม่ได้, สร้าง environment ใหม่ไม่ได้, ถ้าใครเผลอ `DROP FUNCTION` ก็จบ — และนี่คือสาเหตุที่ช่องโหว่ S1 ผ่านมาได้ทุก phase โดยไม่มีใครเห็น |
| **C18** | README ยังเป็น boilerplate | เนื้อหา `create-next-app` เดิม ๆ ไม่มีวิธี setup ไม่มี env var ไม่มี schema |

---

# 4. โค้ดที่แก้ไขแล้ว (Refactored Code)

> ทั้งหมดนี้ยัง **ไม่ได้แก้ลงระบบจริง** ตามที่สั่ง — เป็นตัวอย่างพร้อมใช้ให้เอาไปเทียบ

## 4.1 ปิดช่องโหว่ S1 — ย้ายไปใช้ service_role key ฝั่ง server เท่านั้น

**เหตุผล:** สถาปัตยกรรมปัจจุบันเรียก Supabase จาก server action เสมออยู่แล้ว (ไม่มี client ไหนเรียก Supabase ตรง) ดังนั้นไม่มีเหตุผลใดที่ `anon` ต้องเรียก RPC ได้เลย การถอน grant คือการแก้ที่ต้นเหตุ ใช้เวลาน้อยที่สุด และไม่ต้องรื้อ auth ใหม่ทั้งระบบ

### ขั้นที่ 1 — SQL: ถอนสิทธิ์ทั้งหมด แล้วให้เฉพาะ service_role

```sql
-- ถอน EXECUTE จากทุกฟังก์ชันใน public ทีเดียว (ครอบคลุมทั้ง 42 ตัว)
revoke execute on all functions in schema public from anon, authenticated, public;

-- กันของใหม่ที่จะสร้างในอนาคตไม่ให้ได้สิทธิ์อัตโนมัติ
alter default privileges in schema public revoke execute on functions from anon, authenticated, public;

-- ให้เฉพาะ service_role (key นี้อยู่ฝั่ง server เท่านั้น ไม่มีวันหลุดถึง browser)
grant execute on all functions in schema public to service_role;

-- ลบ overload เก่าทิ้ง (B11) และ dead function (C15)
drop function if exists public.update_task_details(uuid,uuid,text,text,text,date,boolean,text,jsonb,integer);
drop function if exists public.admin_rename_user(uuid,uuid,text);
drop function if exists public.admin_reorder_user(uuid,uuid,text);
drop function if exists public.admin_update_roles(uuid,uuid,user_role[]);
drop function if exists public.update_meeting(uuid,uuid,text,text,integer);
```

### ขั้นที่ 2 — เพิ่ม `p_user_id` guard ที่ยังขาด (S2) และปิด private leak (S4)

```sql
-- S2: set_own_avatar ต้องมีตัวตนจริงก่อน
create or replace function public.set_own_avatar(p_user_id uuid, p_avatar_variant integer)
returns void language plpgsql security definer set search_path to 'public','extensions' as $$
begin
  if not exists (select 1 from users u where u.id = p_user_id) then
    raise exception 'unauthorized';
  end if;
  if p_avatar_variant is not null and (p_avatar_variant < 0 or p_avatar_variant > 9) then
    raise exception 'invalid_avatar_variant';
  end if;
  update users set avatar_variant = p_avatar_variant where id = p_user_id;
end; $$;

-- S4: ถังขยะของบอร์ดต้องเป็นของ admin และต้องกรอง private ตามสิทธิ์
create or replace function public.list_deleted_board_posts(p_user_id uuid)
returns table(id uuid, author_id uuid, author_name text, body text, reminder_date date,
              is_private boolean, tagged_user_ids uuid[], tagged_names text[],
              comments jsonb, version integer, created_at timestamptz)
language sql security definer set search_path to 'public','extensions' as $$
  select bp.id, bp.author_id, bp.author_name, bp.body, bp.reminder_date,
         bp.is_private, bp.tagged_user_ids,
         (select array_agg(u.display_name order by u.display_name)
            from public.users u where u.id = any(bp.tagged_user_ids)),
         bp.comments, bp.version, bp.created_at
  from public.board_posts bp
  where bp.is_deleted = true
    and exists (select 1 from public.users a where a.id = p_user_id and 'admin' = any(a.roles))
    and (bp.is_private = false or bp.author_id = p_user_id or p_user_id = any(bp.tagged_user_ids))
  order by bp.created_at desc;
$$;
```

### ขั้นที่ 3 — `src/lib/supabase.ts` เป็น server-only

```ts
import "server-only";                       // build จะ error ทันทีถ้ามี client component เผลอ import
import { createClient } from "@supabase/supabase-js";

// เหตุผลที่ไม่ใช้ NEXT_PUBLIC_*: ตัวแปรที่ขึ้นต้นด้วย NEXT_PUBLIC_ จะถูกฝังลง JS bundle
// ที่ส่งให้ browser ทุกคน ซึ่งเท่ากับแจก key ให้ผู้โจมตี — ชื่อใหม่นี้อยู่ฝั่ง server เท่านั้น
export function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
```

`.env.local.example` แก้เป็น:

```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SESSION_SECRET=
```

> **ผลลัพธ์:** ทุกคำสั่งต้องผ่าน server action ของเราเสมอ ซึ่งอ่านตัวตนจาก cookie ที่เซ็นด้วย `SESSION_SECRET` → `p_user_id` ไม่ใช่ข้อมูลที่ผู้ใช้ปลอมได้อีกต่อไป

---

## 4.2 แก้ S3 + S6 — session ที่ revoke ได้จริง และ cookie ที่ใช้ได้บน HTTP LAN

```ts
// src/lib/auth.ts
export async function createSession(user: SessionUser) {
  const token = await signSession(user);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    // เหตุผล: ระบบนี้เข้าผ่าน http://192.168.1.186 บน LAN — ถ้า hardcode secure:true ตอน production
    // browser จะไม่ยอมเก็บ cookie เลย ทำให้ login วนลูป (S6)
    // ระยะยาวต้องทำ HTTPS แล้วตั้ง APP_SECURE_COOKIES=true
    secure: process.env.APP_SECURE_COOKIES === "true",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
}
```

```ts
// src/lib/session.ts — ลด TTL และเลิกเชื่อ roles ที่อยู่ใน token
export const SESSION_DURATION_SECONDS = 60 * 60 * 8;   // 8 ชั่วโมง = 1 วันทำงาน

export type SessionUser = { id: string; username: string; displayName: string };
// roles ถูกถอดออกจาก JWT โดยตั้งใจ — อ่านสดจาก DB ทุกครั้งที่ต้องตัดสินใจเรื่องสิทธิ์ (S3)
```

```ts
// src/lib/authz.ts (ไฟล์ใหม่) — จุดเดียวที่ตัดสินใจเรื่องสิทธิ์ทั้งระบบ
import "server-only";
import { getSession } from "./auth";
import { getSupabaseClient } from "./supabase";

export type Actor = { id: string; displayName: string; roles: Role[]; canManageTasks: boolean };

/** อ่านสิทธิ์สดจาก DB เสมอ — ลบ user หรือถอน role แล้วมีผลทันที ไม่ต้องรอ token หมดอายุ */
export async function getActor(): Promise<Actor | null> {
  const session = await getSession();
  if (!session) return null;

  const { data } = await getSupabaseClient()
    .rpc("get_actor", { p_user_id: session.id })
    .single<{ id: string; display_name: string; roles: Role[]; can_manage_tasks: boolean }>();

  if (!data) return null;                       // ถูกลบไปแล้ว → session ใช้ไม่ได้ทันที
  return {
    id: data.id,
    displayName: data.display_name,
    roles: data.roles,
    canManageTasks: data.can_manage_tasks,
  };
}

export async function requireActor(): Promise<Actor> {
  const actor = await getActor();
  if (!actor) throw new Error("unauthorized");
  return actor;
}

export async function requireAdmin(): Promise<Actor> {
  const actor = await requireActor();
  if (!actor.roles.includes("admin")) throw new Error("unauthorized");
  return actor;                                  // ชื่อ requireXxx ที่ throw จริง ต่างจาก requireUser เดิม (C5)
}
```

---

## 4.3 แก้ B1 + B2 — เลิกเดาสถานะจาก log ใช้ state machine ตรง ๆ

**เหตุผล:** ปัญหารากคือ "จำนวน entry ที่เพิ่ม" กับ "จำนวน entry ที่ถอน" ไม่เท่ากัน การเก็บ snapshot ของสถานะไว้ใน entry ทำให้ undo เป็นการ "ย้อนไปยังสถานะที่บันทึกไว้" ไม่ใช่การเดาใหม่ทุกครั้ง

```ts
// board-types.ts — เพิ่ม snapshot ของสถานะ "ก่อน" ลงในแต่ละ entry
export type HistoryEntry = {
  id: string;
  action: HistoryAction;
  owner?: string;
  inspector?: string;
  message?: string;
  notes?: HistoryNote[];
  at: string;
  /** สถานะของงาน "ก่อน" เกิด action นี้ — ใช้ย้อนสถานะได้แม่นยำโดยไม่ต้องเดาจาก action ก่อนหน้า */
  prevStatus: TaskStatus;
  prevInspector?: string;
};
```

```ts
// AppShell.tsx
async function reopenTask(taskId: string) {
  const task = findTaskById(taskId);
  if (!task) return;

  const history = [...task.history];
  const undone = history.pop();
  if (!undone) return;

  // ส่งตรวจซ้ำจะเพิ่ม entry คู่ (reviewed อัตโนมัติ + sent) — ต้องถอนคู่นั้นออกพร้อมกัน
  // ไม่งั้นจะเหลือ "ตรวจแล้ว" ค้างไว้ทั้งที่ไม่มีใครตรวจ (B1)
  const last = history[history.length - 1];
  if (undone.action === "sent" && last?.action === "reviewed" && last.autoSkipped) {
    history.pop();
  }

  const result = await updateTaskWorkflowAction({
    id: taskId,
    version: task.version,
    status: undone.prevStatus,                  // ย้อนไปสถานะที่บันทึกไว้ ไม่ใช่เดาจาก log (B2)
    inspector: undone.prevInspector,            // rollback ผู้ตรวจด้วย — เดิมค้างไว้เป็นคนใหม่
    history,
  });
  if (!reportIfError(result)) return;
  applyTaskUpdate(result.data);
}
```

```ts
// withSkippedReviewEntry — ทำเครื่องหมายว่า entry นี้ระบบเติมให้เอง
function withSkippedReviewEntry(t: Task, history: HistoryEntry[]): HistoryEntry[] {
  if (t.status !== "pending") return history;
  return [...history, {
    id: generateId(),
    action: "reviewed" as const,
    inspector: t.inspector,
    at: new Date().toISOString(),
    autoSkipped: true,                          // ← ธงที่ทำให้ reopen ถอนคู่ได้ถูกต้อง
    prevStatus: t.status,
    prevInspector: t.inspector,
  }];
}
```

**และที่สำคัญกว่า — ย้าย state machine ไปฝั่ง server (แก้ S7):**

```sql
-- แทนที่จะรับ history ทั้งก้อนจาก client ให้รับแค่ "เจตนา" แล้ว server ต่อ log เอง
create or replace function public.apply_task_transition(
  p_user_id uuid, p_id uuid, p_version integer,
  p_action history_action, p_inspector text, p_message text
) returns tasks language plpgsql security definer set search_path to 'public','extensions' as $$
declare v_task tasks; v_new_status task_status; v_entry jsonb;
begin
  select * into v_task from tasks where id = p_id and version = p_version;
  if v_task is null then raise exception 'version_conflict'; end if;

  -- state machine อยู่ที่ server: client ปลอม transition ไม่ได้อีกต่อไป
  v_new_status := case
    when p_action = 'sent'     and v_task.status in ('blank','done','pending') then 'pending'
    when p_action = 'reviewed' and v_task.status = 'pending'                   then 'done'
    when p_action = 'closed'                                                    then 'closed'
    else null end;
  if v_new_status is null then raise exception 'invalid_transition'; end if;

  v_entry := jsonb_build_object(
    'id', gen_random_uuid(), 'action', p_action, 'owner', v_task.owner,
    'inspector', coalesce(p_inspector, v_task.inspector), 'message', p_message,
    'at', now(), 'prevStatus', v_task.status, 'prevInspector', v_task.inspector);

  update tasks
  set status = v_new_status,
      inspector = coalesce(p_inspector, inspector),
      history = coalesce(history,'[]'::jsonb) || v_entry,   -- append เท่านั้น ไม่มีวันถูกทับ
      version = version + 1
  where id = p_id returning * into v_task;
  return v_task;
end; $$;
```

---

## 4.4 แก้ C4 + C6 + C8 — ยุบ boilerplate 20 รอบเหลือ helper เดียว

**เหตุผล:** `board-actions.ts` 309 บรรทัดคือ pattern เดิมซ้ำ 13 รอบ การรวมไว้จุดเดียวทำให้ (1) เพิ่ม logging ได้ทีเดียวครบ (2) ไม่มีทางเผลอ `revalidatePath` ก่อนเช็ค error อีก (3) เพิ่ม action ใหม่เหลือ 5 บรรทัด

```ts
// src/lib/rpc.ts (ไฟล์ใหม่)
import "server-only";
import { revalidatePath } from "next/cache";
import { getSupabaseClient } from "./supabase";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: "unauthorized" | "version_conflict" | "invalid_transition" | "unknown" };

const KNOWN_ERRORS = ["version_conflict", "unauthorized", "invalid_transition"] as const;

export async function callRpc<TRow, TOut>(
  fn: string,
  params: Record<string, unknown>,
  map: (row: TRow) => TOut,
  opts: { revalidate?: string } = {}
): Promise<ActionResult<TOut>> {
  const { data, error } = await getSupabaseClient().rpc(fn, params).single<TRow>();

  if (error) {
    const known = KNOWN_ERRORS.find((code) => error.message.includes(code));
    // C8: เดิมไม่มี log เลยทั้งโปรเจกต์ — พังบน production แล้วไม่มีใครรู้สาเหตุ
    if (!known) console.error(`[rpc:${fn}]`, error.code, error.message, params);
    return { ok: false, error: known ?? "unknown" };
  }
  if (!data) return { ok: false, error: "unknown" };

  // C6: revalidate เฉพาะตอนสำเร็จเท่านั้น
  if (opts.revalidate) revalidatePath(opts.revalidate);
  return { ok: true, data: map(data) };
}
```

```ts
// board-actions.ts — 13 action หดจาก ~250 บรรทัดเหลือแบบละ 5 บรรทัด
export async function createTaskAction(input: CreateTaskInput): Promise<ActionResult<Task>> {
  const actor = await getActor();
  if (!actor?.canManageTasks) return UNAUTHORIZED;

  const title = input.title.trim();
  if (!title || title.length > 500) return { ok: false, error: "unknown" };   // C7: validate ก่อนถึง DB

  return callRpc<TaskRow, Task>("create_task", {
    p_user_id: actor.id,
    p_meeting_id: input.meetingId,
    p_title: title,
    p_ecm_number: input.ecmNumber?.slice(0, 100) || null,
    p_owner: input.owner || null,
    p_due_date: input.dueDate || null,
    p_urgent: input.urgent,
    p_note: input.note?.slice(0, 2000) || null,
  }, mapTask);
  // สังเกต: ไม่ส่ง revalidate เพราะ client apply ผลลัพธ์เองอยู่แล้ว (แก้ P1)
}
```

---

## 4.5 แก้ P1 + P2 + B15 — รับข้อมูลจาก server จริง และหยุดคำนวณซ้ำ

**เหตุผล:** ปัจจุบัน server ทำงานหนักทุก mutation แล้วผลถูกทิ้ง (P1) ขณะที่ client คำนวณซ้ำ 7 รอบต่อ render (P2) แก้สองอย่างนี้พร้อมกันได้ด้วยการ (1) รับ props ใหม่ตาม pattern ที่ `UserList` ทำถูกอยู่แล้ว (2) ห่อ derived value ด้วย `useMemo`

```ts
// AppShell.tsx
export function AppShell({ user, initialMeetings, initialOtherTasks, ... }: Props) {
  const [meetings, setMeetings] = useState(initialMeetings);
  const [otherTasks, setOtherTasks] = useState(initialOtherTasks);

  // B15/P1: รับข้อมูลชุดใหม่จาก server เมื่อ revalidate เกิดขึ้น (pattern เดียวกับ UserList.tsx:23-29)
  // ทำให้ข้อมูลที่ดึงมาถูกใช้จริง และได้ multi-user sync มาฟรี → แก้ B3 ไปด้วย
  const [prevMeetings, setPrevMeetings] = useState(initialMeetings);
  if (initialMeetings !== prevMeetings) {
    setPrevMeetings(initialMeetings);
    setMeetings(initialMeetings);
    setOtherTasks(initialOtherTasks);
  }

  const activeMeetings = useMemo(() => meetings.filter((m) => !m.isArchived), [meetings]);
  const boardMeetings  = useMemo(() => activeMeetings.filter((m) => m.tab === "board"), [activeMeetings]);
  const excomMeetings  = useMemo(() => activeMeetings.filter((m) => m.tab === "excom"), [activeMeetings]);

  // P2: เดิมวนทุก task 7 รอบต่อ render (แม้แค่เปิด avatar picker) — รวบเป็นรอบเดียว
  const notifications = useMemo(() => {
    const count = (tasks: Task[]) => myNotificationCount(tasks, user.displayName);
    const active = mainTab === "excom" ? excomMeetings : boardMeetings;
    const bySub = (key: SubTab) => count(active.filter((m) => m.subTab === key).flatMap((m) => m.tasks));
    return {
      main: {
        board: count(boardMeetings.flatMap((m) => m.tasks)),
        excom: count(excomMeetings.flatMap((m) => m.tasks)),
        other: count(otherTasks),
      },
      sub: { resume: bySub("resume"), draft: bySub("draft"), conduct: bySub("conduct") },
    };
  }, [boardMeetings, excomMeetings, otherTasks, mainTab, user.displayName]);

  // P6: index ให้ lookup เป็น O(1) แทนการ flatMap ทุกประชุมทุกครั้ง
  const taskIndex = useMemo(() => {
    const map = new Map<string, Task>();
    for (const m of meetings) for (const t of m.tasks) map.set(t.id, t);
    for (const t of otherTasks) map.set(t.id, t);
    return map;
  }, [meetings, otherTasks]);

  const findTaskById = useCallback((id: string) => taskIndex.get(id), [taskIndex]);
  // ...
}
```

```ts
// B7: toast ที่เก็บกวาด timer ของตัวเอง
const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

const showToast = useCallback((message: string) => {
  if (toastTimer.current) clearTimeout(toastTimer.current);
  setToast(message);
  toastTimer.current = setTimeout(() => setToast(null), 2500);
}, []);

useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);
```

```ts
// P4: taskSteps เดิมถูกเรียก 3 รอบต่อแถว — คำนวณครั้งเดียวแล้วส่งต่อ
export function taskProgress(steps: ProgressStep[]): number {
  if (steps.length === 0) return 0;
  return Math.round((steps.filter((s) => s.done).length / steps.length) * 100);
}

// ใน TaskRow:
const steps = useMemo(() => taskSteps(task, inspectors), [task, inspectors]);
const progress = taskProgress(steps);
```

---

## 4.6 แก้ B12 — วันที่ที่ไม่เพี้ยนข้าม timezone

**เหตุผล:** `new Date("2026-09-17T00:00:00")` ถูกตีความเป็นเวลาท้องถิ่นของ *เครื่องที่รันโค้ด* ซึ่งบน server คือ UTC แต่บน client คือ UTC+7 → ได้คนละวัน และทำให้ HTML ไม่ตรงกันตอน hydrate

```ts
// board-derived.ts
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

/** แปลง "YYYY-MM-DD" เป็นวันตามเวลาไทยเสมอ ไม่ว่าจะรันบน server (UTC) หรือ browser */
function parseThaiDate(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
}

export function formatShortDate(value?: string): string | null {
  if (!value) return null;
  const d = parseThaiDate(value);
  if (!d) return null;
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yy = String(d.getUTCFullYear() + 543).slice(-2);
  return `${dd}/${mm}/${yy}`;
}

export function reminderUrgency(reminderDate: string | undefined, now: Date): "soon" | "later" | undefined {
  if (!reminderDate) return undefined;
  const target = parseThaiDate(reminderDate);
  if (!target) return undefined;
  // "วันนี้" ตามเวลาไทย คำนวณจาก now ที่ caller ส่งเข้ามา (ทดสอบได้ ไม่ผูกกับนาฬิกาเครื่อง)
  const todayThai = Math.floor((now.getTime() + BANGKOK_OFFSET_MS) / 86400000);
  const targetDay = Math.floor(target.getTime() / 86400000);
  return targetDay - todayThai <= 3 ? "soon" : "later";
}
```

```tsx
// formatRelativeTime ต้องคำนวณบน client เท่านั้น ไม่งั้น server/client ได้คนละค่า
"use client";
export function RelativeTime({ iso }: { iso: string }) {
  const [text, setText] = useState<string | null>(null);   // render ครั้งแรกตรงกับ server เสมอ
  useEffect(() => { setText(formatRelativeTime(iso)); }, [iso]);
  return <time dateTime={iso} title={formatAbsolute(iso)}>{text ?? formatAbsolute(iso)}</time>;
}
```

---

## 4.7 แก้ a11y ของ Modal (ดู UX ข้อ 7)

```tsx
"use client";
import { useEffect, useId, useRef } from "react";

export function Modal({ title, onClose, children }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    panelRef.current?.querySelector<HTMLElement>(
      "input, select, textarea, button, [href], [tabindex]:not([tabindex='-1'])"
    )?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key !== "Tab" || !panelRef.current) return;

      // focus trap: กัน Tab หลุดออกไปหลัง modal
      const items = panelRef.current.querySelectorAll<HTMLElement>(
        "input, select, textarea, button, [href], [tabindex]:not([tabindex='-1'])"
      );
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }

    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";      // กันพื้นหลังเลื่อนตาม

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus();                 // คืน focus ให้ปุ่มที่เปิด modal
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id={titleId} className="font-display text-lg font-semibold text-text">{title}</h3>
        <div className="mt-4 flex flex-col gap-4">{children}</div>
      </div>
    </div>
  );
}
```

---

## 4.8 แก้ B4 + a11y ของแถวงาน + feedback ระหว่างรอ (UX ข้อ 6, 10)

```tsx
// TaskRow.tsx
const [busy, setBusy] = useState(false);

async function runAction(fn: () => void | Promise<void>) {
  if (busy) return;                        // กันกดรัวจนเกิด version_conflict ปลอม (UX ข้อ 10)
  setBusy(true);
  try { await fn(); } finally { setBusy(false); }
}

return (
  <div className={`rounded-xl border bg-bg ${needsMyAction ? "border-pending" : "border-border"}`}>
    {/* a11y: เดิมเป็น div + onClick → กด Tab ไม่ถึง กด Enter ไม่ได้ screen reader ไม่รู้ว่าขยายได้ */}
    <button
      type="button"
      aria-expanded={expanded}
      aria-controls={`task-detail-${task.id}`}
      onClick={() => setExpanded((v) => !v)}
      className={`${TASK_ROW_GRID} w-full cursor-pointer px-2 py-2 text-left hover:bg-closed-soft/30
                  focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none`}
    >
      <span className="min-w-0 ...">{task.title}</span>

      <span className="flex justify-center">
        <span className="inline-flex h-6 w-11 items-center justify-center rounded-md bg-closed-soft ...">
          {/* B4: เดิมเป็น {task.owner} เฉย ๆ → งานที่ยังไม่มีผู้รับผิดชอบโชว์ pill ว่าง */}
          {task.owner ?? <span className={EMPTY_MARK_CLASS}>{EMPTY_MARK}</span>}
        </span>
      </span>
      {/* ... */}
    </button>

    {expanded && (
      <div id={`task-detail-${task.id}`} className="...">
        <button
          type="button"
          disabled={!canSend || busy}
          onClick={() => runAction(() => openModal("send"))}
          className="..."
        >
          {busy ? "กำลังบันทึก..." : "ส่งตรวจ"}
        </button>
      </div>
    )}
  </div>
);
```

```ts
// B13: switch ที่ครอบคลุมข้อมูลจริงจาก DB ไม่ใช่แค่ type
function historyLabel(entry: HistoryEntry): string {
  switch (entry.action) {
    case "sent":     return `${entry.owner ?? ""} (ผู้รับผิดชอบ) > ส่งตรวจ ${entry.inspector ?? ""}`.trim();
    case "reviewed": return `${entry.inspector ?? ""} > ตรวจแล้ว`.trim();
    case "closed":   return `${entry.owner ?? ""} > ปิดงาน`.trim();
    case "reopened": return `${entry.owner ?? ""} > ย้อนสถานะ`.trim();
    default:         return "การดำเนินการที่ไม่รู้จัก";   // ไม่ปล่อยให้ log หายเงียบ ๆ
  }
}
```

---

## 4.9 แก้ B9 + B10 — หน้าที่ป้องกันตัวเอง ไม่พึ่ง middleware อย่างเดียว

```ts
// src/app/page.tsx
import { redirect } from "next/navigation";

export default async function Home() {
  const actor = await getActor();
  if (!actor) redirect("/login");         // เดิม return null → จอขาวเปล่า ไม่มีทางออก (B9)
  // ...
}
```

```ts
// src/app/admin/users/page.tsx
export default async function AdminUsersPage() {
  const admin = await getActor();
  if (!admin) redirect("/login");
  if (!admin.roles.includes("admin")) redirect("/");   // defense in depth ไม่พึ่ง middleware อย่างเดียว (B10)

  const { data: users, error } = await supabase.rpc("admin_list_users", { p_admin_id: admin.id });
  if (error) {
    console.error("[admin_list_users]", error.message);   // เดิม error ถูกทิ้งทั้งก้อน
    throw new Error("โหลดรายชื่อผู้ใช้ไม่สำเร็จ");
  }
  // ...
}
```

---

## 4.10 แก้ B16 — บันทึกลำดับที่รู้ผลจริงและ rollback ได้

```ts
async function handleDragEnd(event: DragEndEvent) {
  const { active, over } = event;
  if (!over || active.id === over.id) return;

  const oldIndex = orderedPeople.findIndex((p) => p.id === active.id);
  const newIndex = orderedPeople.findIndex((p) => p.id === over.id);
  if (oldIndex === -1 || newIndex === -1) return;

  const previous = orderedPeople;                   // เก็บไว้ rollback
  const next = arrayMove(orderedPeople, oldIndex, newIndex);
  setOrderedPeople(next);
  setSaving(true);

  const result = await setDashboardOrderAction(next.map((p) => p.id));
  setSaving(false);
  if (!result?.ok) {
    setOrderedPeople(previous);                     // เดิม: UI เปลี่ยน DB ไม่เปลี่ยน และไม่มีใครรู้
    onError("บันทึกลำดับไม่สำเร็จ กรุณาลองใหม่");
  }
}
```


---

# 5. ข้อเสนอแนะด้าน UX / UI

เรียงตามผลกระทบต่อผู้ใช้จริง (เจ้าหน้าที่ที่ต้องใช้ทุกวัน) มากไปน้อย

## 5.1 ระดับ "ควรแก้" — กระทบการใช้งานประจำวัน

**U1. แยกหน้าจอเป็น route จริง (แก้ C1 ไปในตัว)**
ตอนนี้ 5 หน้าจอเป็น `useState` ตัวเดียว ผลคือ: กด Back จากหน้า Dashboard = **ออกจากแอปเลย**, refresh แล้วเด้งกลับหน้าแรกเสมอ, ส่ง link "ดูงานของฉัน" ให้เพื่อนไม่ได้, เปิดสองแท็บเทียบกันไม่ได้ ควรเป็น `/`, `/my-tasks`, `/board`, `/dashboard`, `/trash`

**U2. Badge ต้องหมายถึง "ยังไม่ได้อ่าน" ไม่ใช่ "ทั้งหมด" (แก้ B6)**
Badge บน The Wall นับ memo ทุกอันที่เกี่ยวกับเรา — เขียนเอง 20 โพสต์ = ขึ้นเลข 20 ตลอดกาล กดอ่านก็ไม่ลด ผู้ใช้จะเลิกสนใจ badge ภายในสัปดาห์แรก ต้องมีตาราง `board_post_reads (user_id, post_id, read_at)` แล้วนับเฉพาะที่ยังไม่อ่าน (และไม่ควรนับโพสต์ของตัวเอง)

**U3. Version conflict ต้องช่วยผู้ใช้ ไม่ใช่สั่งให้ไป refresh เอง (แก้ B3)**
ข้อความปัจจุบัน "ข้อมูลนี้มีการอัปเดตแล้ว กรุณา Refresh หน้าก่อนทำต่อ" + ปุ่ม Refresh = ผู้ใช้เสียสิ่งที่พิมพ์ค้างไว้ทั้งหมด ควรเป็น:
> "คุณสมศรีเพิ่งแก้รายการนี้เมื่อสักครู่ — [ดูข้อมูลล่าสุด] [ทำต่อโดยใช้ของฉัน]"

โดยโหลดข้อมูลใหม่เฉพาะแถวนั้นในที่เดิม ไม่ reload ทั้งหน้า

**U4. เลิกใช้ `confirm()` ใช้ Undo แทน (แก้ C13)**
`confirm()` 7 จุดในระบบ block ทั้งหน้าจอ จัดสไตล์ไม่ได้ และบนมือถือหน้าตาแล้วแต่ browser — และเพราะการลบเป็น **soft delete ลงถังขยะอยู่แล้ว** การถามยืนยันแทบไม่มีประโยชน์ ควรเปลี่ยนเป็น:
- ลบธรรมดา → ลบเลย + toast "ย้ายไปถังขยะแล้ว · [เลิกทำ]" (5 วินาที)
- ลบถาวร / ลบผู้ใช้ → ใช้ `<Modal>` ที่มีอยู่แล้ว ระบุผลที่จะเกิด และให้พิมพ์ชื่อยืนยันถ้าเป็นการลบผู้ใช้

**U5. ไม่มี feedback ระหว่างรอ (แก้ UX ของ B3 ด้วย)**
`useActionState` ให้ `pending` ซึ่งถูกใช้ในฟอร์ม login/admin แต่ **ไม่ถูกใช้ในปุ่มงานเลยสักปุ่ม** — กด "ส่งตรวจ" บนเน็ตช้า ๆ แล้วหน้าจอนิ่งสนิท ผู้ใช้จะกดซ้ำ ซึ่งทำให้เกิด version conflict ปลอม ๆ ต้อง disable ปุ่ม + แสดง spinner ระหว่างรอ

**U6. ค้นหาไม่ได้เลย**
ไม่มีช่องค้นหาในระบบแม้แต่ที่เดียว พอมีประชุมสะสม 20-30 ครั้ง การหา "เรื่องที่ ECM 1234" จะกลายเป็นการไล่เปิดทีละ tab ควรมีช่องค้นหาบน header ที่ค้นได้จาก ชื่อเรื่อง / เลข ECM / ผู้รับผิดชอบ ข้ามทุก tab (น่าจะเป็นฟีเจอร์ที่ถูกขอเป็นอันดับแรกหลัง go-live)

**U7. Empty state ควรมีทางไปต่อ**
"ยังไม่มีวาระ/เรื่อง", "ไม่มีครั้งที่ประชุมในถังขยะ", "No memos yet" เป็นข้อความเปล่า ๆ ควรใส่ปุ่มหลักลงไปในกล่องเลย เช่น "ยังไม่มีวาระ/เรื่อง — [+ เพิ่มเรื่องแรก]"

## 5.2 ระดับ Accessibility — ปัจจุบันใช้คีย์บอร์ดล้วนไม่ได้

**U8. แถวงานและการ์ด memo กดด้วยคีย์บอร์ดไม่ได้**
`TaskRow`, `BoardPostCard`, `BoardPostMiniRow` ใช้ `<div onClick>` → **กด Tab ไม่ถึง, กด Enter ไม่ได้, screen reader ไม่รู้ว่ากดได้** ต้องเป็น `<button>` + `aria-expanded` + `aria-controls` (ดูโค้ดข้อ 4.8)

**U9. Modal ไม่มี Escape / focus trap / body scroll lock**
เปิด modal แล้วกด Esc ไม่ปิด, กด Tab หลุดไปปุ่มข้างหลัง, เลื่อนหน้าจอข้างหลังได้, screen reader ไม่ประกาศว่าเป็น dialog (ดูโค้ดข้อ 4.7)

**U10. ไม่มี focus ring ที่มองเห็นได้**
ทุกปุ่มใช้แต่ `hover:` และ input ใส่ `outline-none` โดยไม่ใส่ `focus-visible:` แทน → ผู้ใช้คีย์บอร์ดไม่รู้เลยว่าตอนนี้อยู่ตรงไหน ควรใส่ global rule:
```css
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
```

**U11. ตัวอักษรเล็กเกินเกณฑ์อ่านได้ และ contrast ไม่ผ่าน**
มี `text-[9.5px]`, `text-[10px]`, `text-[10.5px]`, `text-[11.5px]` กระจายทั่ว — **ภาษาไทยมีวรรณยุกต์บน-ล่าง ที่ 9.5px พร้อม `leading-tight` อ่านแทบไม่ออก** ควรตั้งพื้นล่างที่ 12px สำหรับข้อความ และ 11px สำหรับ label
ส่วน `EMPTY_MARK_CLASS = "text-muted/40"` ให้ contrast ราว 1.8:1 ต่ำกว่าเกณฑ์ WCAG AA (4.5:1) มาก ควรใช้ `text-muted/70` ขึ้นไป

**U12. Heat map ใช้สีเป็นสัญญาณเดียว**
`heatCellClass` แยก 0 / 1 / 2+ ด้วยสีแดงเข้มขึ้น — ผู้ใช้ตาบอดสีแดง-เขียว (~8% ของผู้ชาย) แยกไม่ออก ตัวเลขยังอยู่ก็จริงแต่ไม่มี legend อธิบายว่าสีเข้ม = อะไร ควรเพิ่ม legend และใช้ความเข้มของ token เดียวไล่ระดับแทนการเปลี่ยน hue

## 5.3 ระดับ "ทำให้ดีขึ้น"

**U13. Header บนมือถือแตกเป็น 3 บรรทัด**
มีปุ่ม icon 8 ตัว + ปุ่มออกจากระบบ ใน `flex-wrap` → บนจอ 360px จะ wrap ลงมาเบียดเนื้อหา ควรยุบ "เปลี่ยนรหัสผ่าน / ธีม / ถังขยะ / ออกจากระบบ" เข้าเมนู overflow เดียว เหลือ icon หลัก 3 ตัว หรือทำเป็น bottom tab bar บนมือถือ

**U14. The Wall แบบ masonry ทำให้ลำดับการอ่านสับสน**
`sm:columns-2 lg:columns-3` + หมุนการ์ด + expand ในที่ = การ์ดกระโดดสลับตำแหน่งเวลากดขยาย และลำดับการอ่าน (บน-ลงล่างทีละคอลัมน์) ไม่ตรงกับลำดับเวลา ควรใช้ grid ลำดับคงที่ แล้วกดขยายเป็น modal แทน

**U15. โพสต์ Private หายจากแท็บ "All" แม้แต่ของตัวเอง**
`tab === "all" ? posts.filter(p => !p.isPrivate)` → เจ้าของโพสต์เองก็ไม่เห็นโพสต์ตัวเองในแท็บ All ทำให้รู้สึกว่า "โพสต์หายไปไหน" ควรแสดงพร้อมไอคอนกุญแจ (ซึ่งมี `LockIcon` อยู่แล้ว)

**U16. เวลาแบบ relative ไม่เหมาะกับ audit trail**
"2h ago" ดีสำหรับ social feed แต่สำหรับเอกสารราชการที่ต้องอ้างอิงได้ ควรแสดงเวลาจริง ("17/09/69 14:32") แล้วใส่ relative ไว้ใน tooltip — และควรเป็นภาษาไทยให้ตรงกับส่วนอื่น (แก้ C11 ไปด้วย)

**U17. ถังขยะไม่บอกว่าลบเมื่อไหร่**
ไม่มีวันที่ลบ ไม่มี "ล้างถังขยะ" ไม่มีนโยบายลบอัตโนมัติ → ของจะสะสมไปเรื่อย ๆ และ admin ตัดสินใจไม่ได้ว่าอันไหนลบได้แล้ว ควรเพิ่ม `deleted_at` + แสดง "ลบเมื่อ 3 วันที่แล้ว" + auto-purge หลัง 90 วัน (พร้อมแจ้งเตือน)

**U18. ไม่มีทางเรียงงานตามที่ต้องการ**
ในตารางเรียงตาม `sortOrder` อย่างเดียว (และผู้ใช้เปลี่ยนไม่ได้เพราะไม่มี drag ใน task) ส่วนการเรียงตามวันครบกำหนดมีเฉพาะในหน้า "งานของฉัน" ควรให้คลิกหัวคอลัมน์เพื่อเรียงได้ อย่างน้อยตาม "วันครบกำหนด" และ "สถานะ"

**U19. ผู้ที่ไม่มีสิทธิ์ไม่รู้ว่าทำไมถึงทำไม่ได้**
`canManageTasks === false` ทำให้ปุ่มหายไปเฉย ๆ ผู้ใช้จะคิดว่าระบบพัง ควรแสดงปุ่มแบบ disabled พร้อม tooltip "ต้องมีสิทธิ์สร้าง/แก้ไขวาระ — ติดต่อผู้ดูแลระบบ"

**U20. การเขียน record "ตรวจแล้ว" ให้อัตโนมัติ — เป็นฟีเจอร์ที่ตั้งใจ ไม่ใช่บั๊ก**

> **แก้ไขรายงาน (2026-09-15):** ฉบับแรกเขียนว่าพฤติกรรมนี้ "อันตราย เป็นการเขียน audit log แทนผู้ใช้"
> ผู้ใช้ชี้แจงว่าเป็นการออกแบบที่ตั้งใจ เพื่อรองรับสถานการณ์จริง: **ผู้บังคับบัญชาตรวจเอกสารเรียบร้อยแล้ว แต่ไม่ได้กดปุ่ม "ตรวจแล้ว" ในระบบ (ตรวจนอกระบบ)**
> เจ้าของงานจึงกดปิดงานเลย และต้องการให้ระบบบันทึกให้ว่าผ่านการตรวจแล้วจริง — ถือว่าสะท้อนความจริงในการทำงาน ไม่ใช่การปลอมข้อมูล

สิ่งที่ควรปรับจึงไม่ใช่การเอาฟีเจอร์ออก แต่คือ **ทำให้มันชัดเจนและตรวจสอบได้** 2 จุด:

1. **ถามก่อนเขียน** แทนการเขียนให้เงียบ ๆ — ผู้ใช้ยืนยันว่า "ตรวจแล้วจริง" ก่อนระบบจึงบันทึก
2. **ระบุที่มาของ record** — เขียนว่า `A > ตรวจแล้ว (บันทึกย้อนหลังโดย สมชาย)` ไม่ใช่เขียนให้เหมือน A กดเองในระบบ
   เพราะเอกสารประชุมต้องอ้างอิงย้อนหลังได้ การแยกแยะว่า "ใครกดเอง" กับ "ใครบันทึกแทน" คือสิ่งที่ทำให้ประวัติเชื่อถือได้

**ผลพลอยได้:** การเปลี่ยนมาถามก่อน **ทำให้บั๊ก B1 หายไปเองทั้งหมด โดยไม่ต้องแก้ตรรกะ `reopenTask` เลย** — ดู B1 ประกอบ

---

# 6. ลำดับที่ควรแก้ (แนะนำ)

| ลำดับ | เรื่อง | เหตุผล |
|---|---|---|
| **0** | **S1, S4** — ถอน grant `anon` + ปิด private leak | ระบบเปิดช่องให้ยึด admin อยู่ตอนนี้ ทุกนาทีที่ระบบออนไลน์คือความเสี่ยง ทำได้ใน 30 นาที |
| **0** | **C17** — ดึง SQL ทั้งหมดลง repo เป็น migration | ถ้าไม่ทำข้อนี้ก่อน การแก้ข้อ 0 จะไม่มีใคร review ได้ และปัญหาเดิมจะกลับมาอีก |
| 1 | S3, S6 — session revoke ได้ + cookie ใช้ได้จริง | S6 จะทำให้ระบบ login ไม่ได้เลยตอนขึ้น production |
| 2 | B1, B2, S7 — state machine ย้ายไป server | ข้อมูล workflow/history เพี้ยนอยู่ตอนนี้ ยิ่งใช้นานยิ่งแก้ยาก |
| 3 | P1 — ตัด/ใช้ประโยชน์จาก revalidate | ได้ performance คืนทันทีด้วยการแก้ไม่กี่บรรทัด |
| 4 | B5 — เปลี่ยน owner/inspector เป็น user id | ต้องทำ data migration ยิ่งช้ายิ่งเจ็บ ทำก่อนข้อมูลเยอะกว่านี้ |
| 5 | U8–U12 — accessibility | เป็นระบบราชการ ควรผ่านเกณฑ์พื้นฐาน และแก้ไม่ยาก |
| 6 | C16 — เขียน test ให้ `board-derived.ts` | ป้องกัน B1 กลับมา และเป็นฐานให้ refactor ข้ออื่นอย่างปลอดภัย |
| 7 | C1–C4 — แยก route / ยุบ boilerplate | ทำหลังจากมี test แล้วจะปลอดภัยกว่า |
