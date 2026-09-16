"use client";

import { useState, type FormEvent } from "react";
import type { MeetingSubTab, MeetingTab } from "./board-types";

const TAB_OPTIONS: { key: MeetingTab; label: string }[] = [
  { key: "board", label: "Board" },
  { key: "excom", label: "Excom" },
];

const SUB_TAB_OPTIONS: { key: MeetingSubTab; label: string }[] = [
  { key: "resume", label: "Resume" },
  { key: "draft", label: "ร่างรายงาน" },
  { key: "conduct", label: "Conduct" },
];

export type ResumeMeetingTemplate = { id: string; title: string; tab: MeetingTab; taskTitles: string[] };

export function CreateMeetingForm({
  defaultTab,
  defaultSubTab,
  resumeMeetings,
  onCreate,
  onCancel,
}: {
  defaultTab: MeetingTab;
  defaultSubTab: MeetingSubTab;
  resumeMeetings: ResumeMeetingTemplate[];
  onCreate: (input: {
    title: string;
    timeline: string;
    tab: MeetingTab;
    subTab: MeetingSubTab;
    templateTaskTitles?: string[];
  }) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [timeline, setTimeline] = useState("");
  const [tab, setTab] = useState<MeetingTab>(defaultTab);
  const [subTab, setSubTab] = useState<MeetingSubTab>(defaultSubTab);
  const [templateId, setTemplateId] = useState("");
  const [templateTaskTitles, setTemplateTaskTitles] = useState<string[]>([]);

  const availableTemplates = resumeMeetings.filter((m) => m.tab === tab);

  function selectTemplate(id: string) {
    setTemplateId(id);
    const template = availableTemplates.find((m) => m.id === id);
    if (template) {
      setTitle(template.title);
      setTemplateTaskTitles(template.taskTitles);
    } else {
      setTemplateTaskTitles([]);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onCreate({
      title: title.trim(),
      timeline: timeline.trim(),
      tab,
      subTab,
      templateTaskTitles: templateTaskTitles.length > 0 ? templateTaskTitles : undefined,
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3.5 flex flex-col gap-3 rounded-xl border-2 border-primary bg-primary-soft p-4"
    >
      <div className="flex flex-col gap-1">
        <label className="text-[11.5px] font-medium text-muted">อยู่ใน Tab</label>
        <div className="flex gap-2">
          {TAB_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => {
                setTab(option.key);
                setTemplateId("");
                setTemplateTaskTitles([]);
              }}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                tab === option.key
                  ? "border-transparent bg-accent-soft font-semibold text-accent"
                  : "border-border text-muted hover:bg-closed-soft hover:text-text"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[11.5px] font-medium text-muted">Sub-tab</label>
        <div className="flex gap-2">
          {SUB_TAB_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setSubTab(option.key)}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                subTab === option.key
                  ? "border-transparent bg-accent-soft font-semibold text-accent"
                  : "border-border text-muted hover:bg-closed-soft hover:text-text"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {subTab === "draft" && (
        <div className="flex flex-col gap-1">
          <label className="text-[11.5px] font-medium text-muted">เลือกต้นแบบวาระจาก Resume (ถ้ามี)</label>
          <select
            value={templateId}
            onChange={(e) => selectTemplate(e.target.value)}
            className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent"
          >
            <option value="">-- ไม่ใช้ต้นแบบ (เริ่มจากว่าง) --</option>
            {availableTemplates.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </select>
          {templateId && (
            <p className="text-[11px] text-muted">
              ดึงชื่อ "{title}" และวาระ {templateTaskTitles.length} เรื่องมาให้แล้ว (ไม่รวมผู้รับผิดชอบ/สถานะ/รายละเอียด)
            </p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label className="text-[11.5px] font-medium text-muted">ชื่อครั้งที่ประชุม</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="เช่น ครั้งที่ 11/2569"
          required
          autoFocus
          className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[11.5px] font-medium text-muted">รายละเอียด (ถ้ามี)</label>
        <input
          value={timeline}
          onChange={(e) => setTimeline(e.target.value)}
          placeholder="เช่น ECM ถึง ผวก. 11 กย · ส่งเอกสารรอบแรก 15 กย · รอบสอง 21 กย"
          className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent"
        />
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" className="rounded-lg bg-primary px-3.5 py-2 text-xs font-bold text-on-primary">
          บันทึก
        </button>
        <button type="button" onClick={onCancel} className="text-xs font-medium text-muted hover:underline">
          ยกเลิก
        </button>
      </div>
    </form>
  );
}
