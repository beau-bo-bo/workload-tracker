import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "../AppShell";
import { loadAppData } from "../app-data";

export const metadata: Metadata = { title: "Dashboard · Workload Tracker" };

export default async function DashboardPage() {
  const data = await loadAppData();
  if (!data) redirect("/login");

  return <AppShell screen="dashboard" {...data} />;
}
