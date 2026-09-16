import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "../AppShell";
import { loadAppData } from "../app-data";

export const metadata: Metadata = { title: "The Wall · Workload Tracker" };

export default async function BoardPage() {
  const data = await loadAppData();
  if (!data) redirect("/login");

  return <AppShell screen="board" {...data} />;
}
