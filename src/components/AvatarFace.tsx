import type { ReactNode } from "react";

const STROKE = { fill: "none", stroke: "currentColor", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

/** 10 หน้าตัวการ์ตูนแสดงอารมณ์ชัดเจน แยกแบบกันได้จริงแม้ย่อเล็ก (แก้จากรอบก่อนที่ผสม eye/mouth แบบระบบจนหลายอันหน้าคล้ายกันเกินไป จนดูไม่ต่างกัน ตามที่ผู้ใช้ทัก) — วาดเองในโค้ดทั้งหมด ไม่ใช้ emoji/service ภายนอก วนตามชื่อแบบ deterministic (ดู avatarFaceVariant ใน board-derived.ts) */
const FACES: ReactNode[] = [
  // 0. ยิ้มธรรมดา
  <>
    <circle cx="8.5" cy="10" r="1.5" fill="currentColor" />
    <circle cx="15.5" cy="10" r="1.5" fill="currentColor" />
    <path d="M8 15 Q12 18.2 16 15" {...STROKE} strokeWidth={1.6} />
  </>,
  // 1. ยิ้มอ้าปากกว้าง/หัวเราะ
  <>
    <path d="M6.8 9.8 Q8.5 8 10.2 9.8" {...STROKE} strokeWidth={1.6} />
    <path d="M13.8 9.8 Q15.5 8 17.2 9.8" {...STROKE} strokeWidth={1.6} />
    <ellipse cx="12" cy="16.3" rx="3.6" ry="2.4" fill="currentColor" />
  </>,
  // 2. ขยิบตา
  <>
    <circle cx="8.5" cy="10" r="1.5" fill="currentColor" />
    <path d="M13.8 10 Q15.5 8.3 17.2 10" {...STROKE} strokeWidth={1.5} />
    <path d="M9 16 Q12.5 17.8 15.5 15" {...STROKE} strokeWidth={1.6} />
  </>,
  // 3. แลบลิ้น
  <>
    <path d="M6.8 9.8 Q8.5 8 10.2 9.8" {...STROKE} strokeWidth={1.6} />
    <path d="M13.8 9.8 Q15.5 8 17.2 9.8" {...STROKE} strokeWidth={1.6} />
    <path d="M8.5 15.3 Q12 17.2 15.5 15.3" {...STROKE} strokeWidth={1.6} />
    <path d="M10.8 16.6 Q12 19 13.2 16.6 Z" fill="currentColor" />
  </>,
  // 4. หน้าโกรธ
  <>
    <line x1="6.8" y1="7.8" x2="10" y2="9.3" {...STROKE} strokeWidth={1.5} />
    <line x1="17.2" y1="7.8" x2="14" y2="9.3" {...STROKE} strokeWidth={1.5} />
    <circle cx="8.5" cy="10.6" r="1.3" fill="currentColor" />
    <circle cx="15.5" cy="10.6" r="1.3" fill="currentColor" />
    <line x1="9" y1="16.3" x2="15" y2="16.3" {...STROKE} strokeWidth={1.6} />
  </>,
  // 5. ร้องไห้
  <>
    <circle cx="8.5" cy="10" r="1.4" fill="currentColor" />
    <circle cx="15.5" cy="10" r="1.4" fill="currentColor" />
    <path d="M7.6 11.8 Q6.6 13.4 7.6 14.6 Q8.6 13.4 7.6 11.8 Z" fill="currentColor" />
    <path d="M9 17.2 Q12 15.4 15 17.2" {...STROKE} strokeWidth={1.6} />
  </>,
  // 6. หน้าง่วง
  <>
    <path d="M6.8 10.3 Q8.5 11.6 10.2 10.3" {...STROKE} strokeWidth={1.5} />
    <path d="M13.8 10.3 Q15.5 11.6 17.2 10.3" {...STROKE} strokeWidth={1.5} />
    <circle cx="12" cy="16.3" r="1.5" {...STROKE} strokeWidth={1.4} />
  </>,
  // 7. หน้างง/มึน
  <>
    <line x1="7.2" y1="8.8" x2="9.8" y2="11.2" {...STROKE} strokeWidth={1.4} />
    <line x1="7.2" y1="11.2" x2="9.8" y2="8.8" {...STROKE} strokeWidth={1.4} />
    <line x1="14.2" y1="8.8" x2="16.8" y2="11.2" {...STROKE} strokeWidth={1.4} />
    <line x1="14.2" y1="11.2" x2="16.8" y2="8.8" {...STROKE} strokeWidth={1.4} />
    <path d="M8.5 16 Q10.2 14.7 12 16 Q13.8 17.3 15.5 16" {...STROKE} strokeWidth={1.4} />
  </>,
  // 8. ตกใจ
  <>
    <circle cx="8.5" cy="10" r="2.1" fill="currentColor" />
    <circle cx="15.5" cy="10" r="2.1" fill="currentColor" />
    <circle cx="12" cy="16.3" r="1.5" {...STROKE} strokeWidth={1.4} />
  </>,
  // 9. เฉยๆ/กวนๆ
  <>
    <line x1="7" y1="10" x2="10" y2="10" {...STROKE} strokeWidth={1.7} />
    <line x1="14" y1="10" x2="17" y2="10" {...STROKE} strokeWidth={1.7} />
    <line x1="9" y1="16.3" x2="15" y2="16.3" {...STROKE} strokeWidth={1.6} />
  </>,
];

export const AVATAR_FACE_COUNT = FACES.length;

export function AvatarFace({ variant, className }: { variant: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      {FACES[variant % FACES.length]}
    </svg>
  );
}
