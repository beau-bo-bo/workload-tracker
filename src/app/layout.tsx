import type { Metadata } from "next";
import { IBM_Plex_Sans_Thai, Chakra_Petch } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const plexThai = IBM_Plex_Sans_Thai({
  variable: "--font-plex-thai",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
});

const chakraPetch = Chakra_Petch({
  variable: "--font-chakra",
  subsets: ["thai", "latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Workload Tracker",
  description: "ระบบติดตามภาระงานและ Workflow การส่งตรวจ",
};

const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("theme");
    if (stored === "light" || stored === "dark") {
      document.documentElement.setAttribute("data-theme", stored);
    }
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="th"
      className={`${plexThai.variable} ${chakraPetch.variable} h-full antialiased`}
      /*
       * จุดเดียวในโปรเจกต์ที่ยังต้องมี suppressHydrationWarning และมีเหตุผลรองรับ (ที่เหลือถอดออกหมดแล้ว):
       * THEME_INIT_SCRIPT ด้านบนตั้ง data-theme บน <html> ตั้งแต่ก่อน React เริ่มทำงาน เพื่อไม่ให้หน้าจอกะพริบสีขาวก่อนเข้าโหมดมืด
       * ผลคือ HTML ที่เซิร์ฟเวอร์ส่งมา (ยังไม่มี data-theme) ต่างจากที่เบราว์เซอร์มีจริงตอน hydrate เสมอ — เป็นเรื่องปกติของวิธีนี้
       * ⚠️ ห้ามลอกบรรทัดนี้ไปใส่ที่อื่นเพื่อกลบ warning — warning ที่เหลือทุกตัวคือบั๊กจริงที่ต้องตามแก้ต้นเหตุ
       */
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        {children}
      </body>
    </html>
  );
}
