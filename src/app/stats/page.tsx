// src/app/stats/page.tsx
// Production stats page for Next.js App Router.
// Fix vs previous: added `data-stats-root` on the outer wrapper so the
// warm `--gradient-surface` and scoped utilities (bg-info, bg-success)
// resolve properly. No business logic changed.

"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Target,
  Trophy,
  Layers,
  TrendingUp,
  RefreshCw,
  Compass,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import Navbar from "@/components/common/Navbar";

import { KpiCard } from "@/components/stats/KpiCard";
import { ScoreTrendChart } from "@/components/stats/ScoreTrendChart";
import { DepartmentChart } from "@/components/stats/DepartmentChart";
import { AnswerBreakdown } from "@/components/stats/AnswerBreakdown";
import { DepartmentCard } from "@/components/stats/DepartmentCard";
import { RecentExams } from "@/components/stats/RecentExams";
import { SectionsPanel } from "@/components/stats/SectionsPanel";

import {
  fetchUserStats,
  fetchExamHistory,
  totalSeconds,
  fmtTime,
  num,
  type UserExamStats,
  type ExamHistoryRecord,
} from "@/lib/stats-api";

import { createClient } from "@/lib/supabase/client";
import { getCurrentBusinessUserId } from "@/lib/userIdentity";

const RECENT_LIMIT = 5;
const HISTORY_LIMIT = 20;

type AuthState =
  | { status: "loading" }
  | { status: "unauthenticated" }
  | { status: "ready"; token: string; userId: string };

export default function StatsPage() {
  const router = useRouter();

  // --- Auth ---
  const [auth, setAuth] = useState<AuthState>({ status: "loading" });

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    const resolveAuth = async (token: string | null | undefined) => {
      if (!token) {
        if (!cancelled) setAuth({ status: "unauthenticated" });
        return;
      }
      try {
        const userId = await getCurrentBusinessUserId();
        if (cancelled) return;
        if (!userId) {
          setAuth({ status: "unauthenticated" });
          return;
        }
        setAuth({ status: "ready", token, userId });
      } catch {
        if (!cancelled) setAuth({ status: "unauthenticated" });
      }
    };

    supabase.auth.getSession().then(({ data }) => {
      void resolveAuth(data.session?.access_token);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      void resolveAuth(session?.access_token);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  // --- Data ---
  const [stats, setStats] = useState<UserExamStats | null>(null);
  const [history, setHistory] = useState<ExamHistoryRecord[] | null>(null);
  const [historyTotal, setHistoryTotal] = useState<number | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    if (auth.status !== "ready") return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setError(null);
    try {
      const creds = { token: auth.token, userId: auth.userId, signal: ctrl.signal };
      const [s, h] = await Promise.all([
        fetchUserStats(creds),
        fetchExamHistory(creds, HISTORY_LIMIT),
      ]);
      if (ctrl.signal.aborted) return;
      setStats(s);
      setHistory(h.exams);
      setHistoryTotal(h.total);
    } catch (e) {
      if ((e as { name?: string })?.name === "AbortError") return;
      setError(e instanceof Error ? e.message : "Failed to load stats");
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }, [auth]);

  useEffect(() => {
    if (auth.status === "ready") void load();
    return () => abortRef.current?.abort();
  }, [auth.status, load]);

  // --- Derived ---
  const allDepts = stats?.allDepartments ?? [];

  useEffect(() => {
    if (allDepts.length === 0) return;
    if (!selectedDeptId || !allDepts.some((d) => d.departmentId === selectedDeptId)) {
      setSelectedDeptId(allDepts[0].departmentId);
    }
  }, [allDepts, selectedDeptId]);

  const selectedDept = useMemo(
    () => allDepts.find((d) => d.departmentId === selectedDeptId) ?? null,
    [allDepts, selectedDeptId],
  );

  const overall = useMemo(() => {
    if (!stats) return null;
    let weightedAcc = 0, attempted = 0, passed = 0, exams = 0, totalTime = 0;
    for (const d of allDepts) {
      const att = d.totalAttemptedQuestions || 0;
      weightedAcc += num(d.averageAccuracy) * att;
      attempted += att;
      passed += d.passedCount || 0;
      exams += d.totalExams || 0;
      totalTime += totalSeconds(d.totalTimeTaken);
    }
    return {
      accuracy: attempted > 0 ? weightedAcc / attempted : 0,
      passRate: exams > 0 ? (passed / exams) * 100 : 0,
      passed,
      totalExams: stats.totalExams ?? exams,
      totalDepts: stats.totalDepartments ?? stats.departmentExams.length,
      timeSpentSec: totalTime,
    };
  }, [stats, allDepts]);

  return (
    // 👇 data-stats-root makes the warm surface + scoped utilities apply
    //    here only, leaving every other page untouched.
    <div
      data-stats-root
      className="min-h-screen bg-[image:var(--gradient-surface)]"
    >
      <Navbar
        variant="stats"
        title="My Statistics"
        subtitle="Track your exam performance"
        backHref="/"
        statsInfo={
          <>
            <button
              type="button"
              onClick={load}
              disabled={loading || auth.status !== "ready"}
              title="Refresh"
              aria-label="Refresh statistics"
              className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white/70 hover:bg-white px-2.5 py-1 text-stone-600 hover:text-stone-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
            {overall && (
              <span className="text-stone-500">
                {overall.totalExams} Exams · {overall.totalDepts} Dept
                {overall.totalDepts !== 1 ? "s" : ""}
              </span>
            )}
          </>
        }
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">
        {auth.status === "loading" || (auth.status === "ready" && !error && !stats) ? (
          <LoadingSkeleton />
        ) : auth.status === "unauthenticated" ? (
          <SignInPrompt onSignIn={() => router.push("/auth/signin?redirect=%2Fstats")} />
        ) : error || !stats || stats.totalExams === 0 ? (
          <EmptyState onStart={() => router.push("/departments")} />
        ) : (
          <>
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <KpiCard label="Total Exams" value={String(overall?.totalExams ?? 0)}
                caption={(overall?.totalExams ?? 0) === 1 ? "Attempt" : "Attempts Logged"}
                icon={FileText} variant="primary" />
              <KpiCard label="Accuracy" value={`${(overall?.accuracy ?? 0).toFixed(1)}%`}
                caption="Weighted Average" icon={Target} variant="info" />
              <KpiCard label="Pass Rate" value={`${(overall?.passRate ?? 0).toFixed(1)}%`}
                caption={`${overall?.passed ?? 0}/${overall?.totalExams ?? 0} Passed`}
                icon={Trophy} variant="success" />
              <KpiCard label="Departments" value={String(overall?.totalDepts ?? 0)}
                caption={`${fmtTime({
                  hours: Math.floor((overall?.timeSpentSec ?? 0) / 3600),
                  minutes: Math.floor(((overall?.timeSpentSec ?? 0) % 3600) / 60),
                  seconds: (overall?.timeSpentSec ?? 0) % 60,
                })} Total`} icon={Layers} variant="warm" />
            </section>

            <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <ScoreTrendChart exams={history ?? []} />
              <DepartmentChart departments={allDepts} />
            </section>

            <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
              <div className="lg:col-span-2"><AnswerBreakdown stats={stats} /></div>
              <InsightCard stats={stats} history={history ?? []} />
            </section>

            <section>
              <div className="mb-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-foreground">
                    Department Breakdown
                  </h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Per-department performance with section-level details
                  </p>
                </div>
                {allDepts.length > 1 && (
                  <div className="inline-flex items-center gap-2 self-start sm:self-auto rounded-full border border-primary/30 bg-primary/5 text-primary px-3 py-1.5 text-xs font-semibold shadow-sm">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                    </span>
                    Tap any department to view its sections
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6 items-start">
                <div className="lg:col-span-2 space-y-4 sm:space-y-6">
                  {allDepts.map((d, i) => (
                    <DepartmentCard
                      key={d.departmentId}
                      dept={d}
                      index={i}
                      selected={selectedDeptId === d.departmentId}
                      onSelect={() => setSelectedDeptId(d.departmentId)}
                    />
                  ))}
                </div>
                <div className="lg:col-span-3 lg:sticky lg:top-24">
                  <SectionsPanel dept={selectedDept} />
                </div>
              </div>
            </section>

            <section>
              <RecentExams exams={(history ?? []).slice(0, RECENT_LIMIT)} total={historyTotal} />
            </section>
          </>
        )}
      </main>
    </div>
  );
}

// ---------- Sub views ----------
function SignInPrompt({ onSignIn }: { onSignIn: () => void }) {
  return (
    <Card className="p-8 sm:p-12 text-center border-border/60 shadow-[var(--shadow-card)]">
      <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-[image:var(--gradient-primary)] flex items-center justify-center shadow-md">
        <TrendingUp className="w-10 h-10 text-primary-foreground" />
      </div>
      <h2 className="text-2xl font-bold text-foreground mb-2">
        Please sign in to view your stats
      </h2>
      <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
        Your performance analytics are tied to your RailJee account.
      </p>
      <Button size="lg" onClick={onSignIn}
        className="bg-[image:var(--gradient-primary)] hover:shadow-[var(--shadow-glow)] transition-shadow">
        Sign in
      </Button>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}

function EmptyState({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="w-full max-w-xl p-10 sm:p-12 text-center border-border/60 shadow-[var(--shadow-card)]">
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-[image:var(--gradient-warm)] flex items-center justify-center shadow-md">
          <FileText className="w-10 h-10 text-white" />
        </div>
        <h3 className="text-2xl font-bold text-foreground mb-2">
          No statistics available yet
        </h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto mb-7">
          Once you attempt your first practice test, your accuracy, score
          trends and department wise insights will appear here. Begin a test
          to start tracking your progress.
        </p>
        <Button
          size="lg"
          onClick={onStart}
          className="bg-[image:var(--gradient-primary)] hover:shadow-[var(--shadow-glow)] transition-shadow gap-2"
        >
          <Compass className="w-4 h-4" />
          Browse Departments
        </Button>
      </Card>
    </div>
  );
}

function InsightCard({
  stats, history,
}: { stats: UserExamStats; history: ExamHistoryRecord[] }) {
  const insights = useMemo(() => {
    const items: { label: string; value: string; tone: "good" | "bad" | "neutral" }[] = [];
    const allDepts = stats?.allDepartments ?? stats?.departmentExams ?? [];
    const ranked = [...(Array.isArray(allDepts) ? allDepts : [])]
      .sort((a, b) => num(b.averageAccuracy) - num(a.averageAccuracy));
    if (ranked.length > 0) {
      const best = ranked[0];
      items.push({
        label: "Strongest department",
        value: `${best.departmentId} (${num(best.averageAccuracy).toFixed(1)}%)`,
        tone: "good",
      });
      if (ranked.length > 1) {
        const worst = ranked[ranked.length - 1];
        items.push({
          label: "Needs improvement",
          value: `${worst.departmentId} (${num(worst.averageAccuracy).toFixed(1)}%)`,
          tone: "bad",
        });
      }
    }
    if (Array.isArray(history) && history.length > 0) {
      const latest = [...history].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )[0];
      const paperName = latest.paperName || latest.paperCode || "Unknown Paper";
      items.push({
        label: "Latest attempt",
        value: `${latest.percentage.toFixed(1)}% on ${
          paperName.length > 32 ? paperName.slice(0, 32) + "..." : paperName
        }`,
        tone: latest.isPassed ? "good" : "neutral",
      });
    }
    if (Array.isArray(history) && history.length >= 2) {
      const sorted = [...history].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
      const half = Math.floor(sorted.length / 2);
      const oldAvg = sorted.slice(0, half).reduce((s, e) => s + e.percentage, 0) / Math.max(1, half);
      const newAvg = sorted.slice(half).reduce((s, e) => s + e.percentage, 0) / Math.max(1, sorted.length - half);
      const delta = newAvg - oldAvg;
      items.push({
        label: "Score trend",
        value: `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}% vs earlier attempts`,
        tone: delta >= 0 ? "good" : "bad",
      });
    }
    return items;
  }, [stats, history]);

  return (
    <Card className="p-5 sm:p-6 border-border/60 shadow-[var(--shadow-card)]">
      <h3 className="font-bold text-foreground mb-1">Insights</h3>
      <p className="text-xs text-muted-foreground mb-4">Auto-generated from your data</p>
      <ul className="space-y-3">
        {insights.length === 0 ? (
          <li className="text-sm text-muted-foreground">Take more exams to unlock insights.</li>
        ) : (
          insights.map((it, i) => (
            <li key={i} className="flex items-start gap-3">
              <span
                className={
                  "mt-1 w-2 h-2 rounded-full shrink-0 " +
                  (it.tone === "good"
                    ? "bg-success"
                    : it.tone === "bad"
                      ? "bg-destructive"
                      : "bg-info")
                }
              />
              <div className="min-w-0 flex-1">
                <div className="text-xs tracking-wide text-muted-foreground font-semibold">
                  {it.label}
                </div>
                <div className="text-sm font-semibold text-foreground capitalize break-words">
                  {it.value}
                </div>
              </div>
            </li>
          ))
        )}
      </ul>
    </Card>
  );
}
