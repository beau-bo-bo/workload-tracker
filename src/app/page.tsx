import { redirect } from "next/navigation";
import { AppShell } from "./AppShell";
import { loadAppData } from "./app-data";

export default async function Home() {
  const data = await loadAppData();
  // เดิม return null ตรงนี้ → ผู้ใช้ที่ session หมดอายุเจอจอขาวเปล่า ๆ โดยไม่มีอะไรบอก (แก้ B9)
  if (!data) redirect("/login");

  return <AppShell screen="main" {...data} />;
}
