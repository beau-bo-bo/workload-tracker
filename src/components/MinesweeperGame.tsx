"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getDailyLeaderboardAction, submitMinesweeperScoreAction, type LeaderboardEntry } from "@/app/game-actions";

const ROWS = 9;
const COLS = 9;
const MINES = 10;
const LONG_PRESS_MS = 450;

type Cell = {
  mine: boolean;
  revealed: boolean;
  flagged: boolean;
  adjacent: number;
};

type GameStatus = "idle" | "playing" | "won" | "lost";

const NUMBER_COLORS: Record<number, string> = {
  1: "text-blue-500",
  2: "text-emerald-600",
  3: "text-red-500",
  4: "text-indigo-700",
  5: "text-amber-700",
  6: "text-cyan-600",
  7: "text-text",
  8: "text-muted",
};

function makeEmptyGrid(): Cell[][] {
  return Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({ mine: false, revealed: false, flagged: false, adjacent: 0 }))
  );
}

function neighborsOf(r: number, c: number): [number, number][] {
  const out: [number, number][] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) out.push([nr, nc]);
    }
  }
  return out;
}

// วางระเบิดหลังคลิกแรกเสมอ (กันคลิกแรกโดนระเบิด) และเว้นช่องรอบ ๆ จุดคลิกแรกไว้ด้วย
// เพื่อให้เปิดกระดานมาแล้วได้พื้นที่โล่งเริ่มต้นเหมือนมายสวีปเปอร์ทั่วไป
function generateGrid(safeR: number, safeC: number): Cell[][] {
  const grid = makeEmptyGrid();
  const safeZone = new Set([`${safeR},${safeC}`, ...neighborsOf(safeR, safeC).map(([r, c]) => `${r},${c}`)]);

  let placed = 0;
  while (placed < MINES) {
    const r = Math.floor(Math.random() * ROWS);
    const c = Math.floor(Math.random() * COLS);
    if (safeZone.has(`${r},${c}`) || grid[r][c].mine) continue;
    grid[r][c].mine = true;
    placed++;
  }

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c].mine) continue;
      grid[r][c].adjacent = neighborsOf(r, c).filter(([nr, nc]) => grid[nr][nc].mine).length;
    }
  }
  return grid;
}

function revealFlood(grid: Cell[][], startR: number, startC: number) {
  const stack: [number, number][] = [[startR, startC]];
  while (stack.length > 0) {
    const [r, c] = stack.pop()!;
    const cell = grid[r][c];
    if (cell.revealed || cell.flagged) continue;
    cell.revealed = true;
    if (cell.adjacent === 0 && !cell.mine) {
      for (const [nr, nc] of neighborsOf(r, c)) stack.push([nr, nc]);
    }
  }
}

function countRevealedSafe(grid: Cell[][]): number {
  let n = 0;
  for (const row of grid) for (const cell of row) if (cell.revealed && !cell.mine) n++;
  return n;
}

function formatSeconds(s: number): string {
  return `${s}s`;
}

// แยกออกมาเป็นฟังก์ชันนอกคอมโพเนนต์ เพราะ eslint react-hooks/purity ห้ามเรียก Date.now()
// ตรงๆ ในฟังก์ชันที่อยู่ในคอมโพเนนต์ (ถึงจะเรียกจาก event handler ก็ตาม)
function nowMs(): number {
  return Date.now();
}

export function MinesweeperGame({ onClose }: { onClose: () => void }) {
  const [grid, setGrid] = useState<Cell[][]>(makeEmptyGrid);
  const [status, setStatus] = useState<GameStatus>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[] | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const longPressRef = useRef<{ timer: ReturnType<typeof setTimeout> | null; triggered: boolean }>({
    timer: null,
    triggered: false,
  });

  const loadLeaderboard = useCallback(() => {
    getDailyLeaderboardAction().then((res) => {
      if (res.ok) setLeaderboard(res.data);
    });
  }, []);

  useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);

  useEffect(() => {
    if (status !== "playing") return;
    const id = setInterval(() => {
      if (startedAtRef.current) setElapsed(Math.floor((nowMs() - startedAtRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [status]);

  function resetGame() {
    setGrid(makeEmptyGrid());
    setStatus("idle");
    setElapsed(0);
    startedAtRef.current = null;
  }

  function revealCell(r: number, c: number) {
    if (status === "won" || status === "lost") return;
    if (grid[r][c].flagged) return;

    let nextGrid = grid;
    let nextStatus: GameStatus = status;

    if (status === "idle") {
      nextGrid = generateGrid(r, c);
      nextStatus = "playing";
      startedAtRef.current = nowMs();
      setElapsed(0);
    } else {
      nextGrid = grid.map((row) => row.map((cell) => ({ ...cell })));
    }

    if (nextGrid[r][c].revealed) return;

    if (nextGrid[r][c].mine) {
      for (const row of nextGrid) for (const cell of row) if (cell.mine) cell.revealed = true;
      setGrid(nextGrid);
      setStatus("lost");
      return;
    }

    revealFlood(nextGrid, r, c);

    if (countRevealedSafe(nextGrid) === ROWS * COLS - MINES) {
      setGrid(nextGrid);
      setStatus("won");
      const seconds = startedAtRef.current ? Math.max(1, Math.round((nowMs() - startedAtRef.current) / 1000)) : 1;
      setElapsed(seconds);
      submitMinesweeperScoreAction(seconds).then((res) => {
        if (res.ok) loadLeaderboard();
      });
      return;
    }

    setGrid(nextGrid);
    setStatus(nextStatus);
  }

  function toggleFlag(r: number, c: number) {
    if (status !== "playing" && status !== "idle") return;
    if (grid[r][c].revealed) return;
    setGrid((prev) => {
      const next = prev.map((row) => row.map((cell) => ({ ...cell })));
      next[r][c].flagged = !next[r][c].flagged;
      return next;
    });
  }

  function cellTouchStart(r: number, c: number) {
    longPressRef.current.triggered = false;
    longPressRef.current.timer = setTimeout(() => {
      longPressRef.current.triggered = true;
      toggleFlag(r, c);
    }, LONG_PRESS_MS);
  }

  function cellTouchEnd() {
    if (longPressRef.current.timer) clearTimeout(longPressRef.current.timer);
  }

  function cellClick(r: number, c: number) {
    if (longPressRef.current.triggered) {
      longPressRef.current.triggered = false;
      return;
    }
    revealCell(r, c);
  }

  const flagCount = grid.reduce((n, row) => n + row.filter((c) => c.flagged).length, 0);
  const face = status === "won" ? "😎" : status === "lost" ? "😵" : "🙂";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="max-h-full w-full max-w-md overflow-auto rounded-xl border border-border bg-surface p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-[15px] font-semibold text-text">💣 มายสวีปเปอร์</h2>
          <button type="button" onClick={onClose} className="text-lg leading-none text-muted hover:text-text">
            ✕
          </button>
        </div>

        <div className="mb-3 flex items-center justify-between rounded-lg border border-border bg-bg px-3 py-2 text-[13px] font-medium text-text">
          <span>🚩 {MINES - flagCount}</span>
          <button type="button" onClick={resetGame} className="text-xl leading-none">
            {face}
          </button>
          <span>⏱ {formatSeconds(elapsed)}</span>
        </div>

        <div
          className="mx-auto grid touch-none select-none gap-[2px]"
          style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`, maxWidth: 342 }}
        >
          {grid.map((row, r) =>
            row.map((cell, c) => (
              <button
                key={`${r}-${c}`}
                type="button"
                onClick={() => cellClick(r, c)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  toggleFlag(r, c);
                }}
                onTouchStart={() => cellTouchStart(r, c)}
                onTouchEnd={cellTouchEnd}
                onTouchMove={cellTouchEnd}
                className={`flex aspect-square items-center justify-center rounded-[3px] text-[13px] font-bold ${
                  cell.revealed
                    ? "bg-bg"
                    : "bg-border/60 hover:bg-border active:bg-border"
                } ${cell.revealed && cell.mine ? "bg-pending-soft" : ""}`}
              >
                {cell.flagged && !cell.revealed && "🚩"}
                {cell.revealed && cell.mine && "💣"}
                {cell.revealed && !cell.mine && cell.adjacent > 0 && (
                  <span className={NUMBER_COLORS[cell.adjacent]}>{cell.adjacent}</span>
                )}
              </button>
            ))
          )}
        </div>

        {status === "won" && (
          <p className="mt-3 text-center text-[13px] font-medium text-done">
            ชนะแล้ว! ใช้เวลา {elapsed} วินาที ส่งคะแนนขึ้น leaderboard แล้ว
          </p>
        )}
        {status === "lost" && (
          <p className="mt-3 text-center text-[13px] font-medium text-pending">
            โดนระเบิด — กดหน้ายิ้มเพื่อเล่นใหม่
          </p>
        )}

        <div className="mt-4 border-t border-border pt-3">
          <div className="mb-1.5 text-[12px] font-semibold text-muted">อันดับวันนี้</div>
          {leaderboard === null && <div className="text-[12px] text-muted">กำลังโหลด...</div>}
          {leaderboard !== null && leaderboard.length === 0 && (
            <div className="text-[12px] text-muted">ยังไม่มีใครชนะวันนี้ เป็นคนแรกสิ!</div>
          )}
          {leaderboard !== null && leaderboard.length > 0 && (
            <ol className="space-y-1 text-[13px] text-text">
              {leaderboard.map((entry, i) => (
                <li key={`${entry.displayName}-${i}`} className="flex items-center justify-between">
                  <span>
                    {i + 1}. {entry.displayName}
                  </span>
                  <span className="text-muted">{formatSeconds(entry.seconds)}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
