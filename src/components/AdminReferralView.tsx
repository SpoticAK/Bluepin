import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronLeft,
  Circle,
  Copy,
  ExternalLink,
  RefreshCw,
  Search,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "../lib/utils";
import { auth } from "../lib/firebase";

interface ReferralCodeItem {
  id: string;
  code: string;
  applicantName: string;
  applicantEmail?: string | null;
  applicantAge?: number | null;
  applicantLinkedinUrl?: string | null;
  isActive: boolean;
  totalSignups: number;
  qualifiedSignups: number;
  totalScore: number;
  createdAt?: number;
}

interface ReferralMilestone {
  achievedAt: number;
}

interface ReferralMilestones {
  onboarded?: ReferralMilestone;
  glucose3days?: ReferralMilestone;
  labReportUploaded?: ReferralMilestone;
  whatsappLinked?: ReferralMilestone;
  active7days?: ReferralMilestone;
}

interface ReferralEventItem {
  id: string;
  uid: string;
  /** Resolved from users/{uid}.name when the user completed onboarding. */
  displayName?: string | null;
  /** Email of the referred user (stored at attribution or read from Auth). */
  referredEmail?: string | null;
  refCode: string;
  attributedAt: number;
  signupMethod: "Email" | "Google";
  score: number;
  lastScoredAt?: number;
  milestones?: ReferralMilestones;
  _disqualifyReason?: string;
}

const MAX_POINTS = 9;

const MILESTONES: ReadonlyArray<{
  key: keyof ReferralMilestones;
  label: string;
  points: number;
}> = [
  { key: "onboarded", label: "Onboarded", points: 1 },
  { key: "glucose3days", label: "Glucose 3d", points: 2 },
  { key: "labReportUploaded", label: "Lab report", points: 2 },
  { key: "whatsappLinked", label: "WhatsApp", points: 1 },
  { key: "active7days", label: "Active 7d", points: 3 },
];

function formatTimestamp(ts?: number, pattern = "MMM d, yyyy") {
  if (!ts) return "";
  const date = new Date(ts);
  return Number.isNaN(date.getTime()) ? "" : format(date, pattern);
}

function eventUserLabel(ev: ReferralEventItem) {
  if (ev.referredEmail) return ev.referredEmail;
  if (ev.displayName) return ev.displayName;
  return ev.uid ? `u_${ev.uid.slice(0, 8)}...` : "Unknown user";
}

function formatFlagReason(reason: string) {
  return reason === "ip_cluster" ? "Shared IP" : reason.replace(/_/g, " ");
}

function StatCard({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string | number;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-xl border border-theme-border/60 bg-theme-bg p-2.5 text-center sm:p-3">
      <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wider text-theme-text-sec">
        {label}
      </span>
      <span className={cn("block text-lg font-bold leading-tight", valueClassName)}>
        {value}
      </span>
    </div>
  );
}

function MilestoneBadge({
  label,
  points,
  milestone,
}: {
  label: string;
  points: number;
  milestone?: ReferralMilestone;
}) {
  const achieved = Boolean(milestone);
  const achievedOn = milestone
    ? formatTimestamp(milestone.achievedAt, "MMM d, yyyy")
    : "";

  return (
    <div
      title={
        achieved && achievedOn
          ? `${label} achieved on ${achievedOn}`
          : `${label} not achieved yet`
      }
      className={cn(
        "flex min-w-0 items-center gap-1.5 rounded-lg border px-2 py-1.5",
        achieved
          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
          : "border-theme-border/50 bg-theme-bg text-theme-text-sec opacity-60",
      )}
    >
      {achieved ? (
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
      ) : (
        <Circle className="h-3.5 w-3.5 shrink-0" />
      )}
      <span className="min-w-0 truncate">
        {label} <span className="font-semibold">(+{points})</span>
      </span>
    </div>
  );
}

export default function AdminReferralView() {
  const [codes, setCodes] = useState<ReferralCodeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [events, setEvents] = useState<ReferralEventItem[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [isScoring, setIsScoring] = useState(false);
  const [scoringMsg, setScoringMsg] = useState<string | null>(null);

  const listRef = useRef<HTMLElement>(null);
  const detailRef = useRef<HTMLElement>(null);

  // Fetch summary leaderboard from API
  const fetchCodes = async () => {
    try {
      setLoading(true);
      const user = auth.currentUser;
      if (!user) return;
      const token = await user.getIdToken();

      const res = await fetch("/api/referrals/admin/summary", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCodes(data.codes || []);
        // Only auto-open the top applicant on the split-pane desktop layout.
        // On phones/tablets that would hide the list behind a detail view.
        if (
          data.codes?.length > 0 &&
          !selectedCode &&
          window.matchMedia("(min-width: 1280px)").matches
        ) {
          setSelectedCode(data.codes[0].code);
        }
      }
    } catch (err) {
      console.error("Failed to load referral leaderboard:", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch events for selected applicant code
  const fetchCodeDetails = async (code: string) => {
    try {
      setLoadingEvents(true);
      const user = auth.currentUser;
      if (!user) return;
      const token = await user.getIdToken();

      const res = await fetch(
        `/api/referrals/admin/summary?code=${encodeURIComponent(code)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
      }
    } catch (err) {
      console.error(`Failed to load details for ${code}:`, err);
    } finally {
      setLoadingEvents(false);
    }
  };

  // Trigger immediate scoring sweep
  const triggerScoringSweep = async () => {
    try {
      setIsScoring(true);
      setScoringMsg(null);

      const user = auth.currentUser;
      if (!user) {
        setScoringMsg("You must be signed in to re-score referrals");
        return;
      }
      const token = await user.getIdToken();

      const res = await fetch("/api/referrals/admin/rescore?force=true", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setScoringMsg(
          `Scored ${data.processed} users (+${data.pointsAwardedTotal} pts awarded)`,
        );
        await fetchCodes();
        if (selectedCode) await fetchCodeDetails(selectedCode);
      } else {
        setScoringMsg(data.error || "Failed to trigger scoring");
      }
    } catch (err: any) {
      setScoringMsg(err.message || "Scoring request error");
    } finally {
      setIsScoring(false);
      setTimeout(() => setScoringMsg(null), 5000);
    }
  };

  useEffect(() => {
    fetchCodes();
  }, []);

  useEffect(() => {
    if (!selectedCode) return;
    fetchCodeDetails(selectedCode);

    // On stacked layouts the detail pane replaces the list, so bring it into
    // view instead of leaving the page at the previous list scroll position.
    if (window.matchMedia("(max-width: 1279px)").matches) {
      requestAnimationFrame(() => {
        detailRef.current?.scrollIntoView({ block: "start" });
      });
    }
  }, [selectedCode]);

  const filteredCodes = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return codes;
    return codes.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        c.applicantName.toLowerCase().includes(q) ||
        (c.applicantEmail && c.applicantEmail.toLowerCase().includes(q)),
    );
  }, [codes, searchQuery]);

  const rankByCode = useMemo(
    () => new Map(codes.map((code, index) => [code.code, index + 1])),
    [codes],
  );

  const activeCodeObj = useMemo(
    () => codes.find((c) => c.code === selectedCode),
    [codes, selectedCode],
  );

  const copyReferralLink = async (code: string) => {
    const configuredAppUrl = (import.meta.env.VITE_APP_URL as string | undefined)
      ?.trim()
      .replace(/\/$/, "");
    const baseUrl = configuredAppUrl || window.location.origin;
    const link = `${baseUrl}/?ref=${code}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedCode(code);
      setTimeout(
        () =>
          setCopiedCode((current) => (current === code ? null : current)),
        2000,
      );
    } catch (err) {
      console.error("Failed to copy referral link:", err);
    }
  };

  const goBackToList = () => {
    setSelectedCode(null);
    if (window.matchMedia("(max-width: 1279px)").matches) {
      requestAnimationFrame(() => {
        listRef.current?.scrollIntoView({ block: "start" });
      });
    }
  };

  if (loading && codes.length === 0) {
    return (
      <div className="flex w-full flex-col items-center justify-center gap-3 py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-theme-border border-t-blue-500" />
        <p className="text-sm text-theme-text-sec">
          Loading referral leaderboard...
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex flex-col overflow-hidden rounded-2xl border border-theme-border bg-theme-card shadow-sm xl:h-[calc(100dvh-7rem)] xl:flex-row">
        {/* Left Pane - Leaderboard */}
        <section
          ref={listRef}
          aria-label="Applicant leaderboard"
          className={cn(
            "flex w-full flex-col border-b border-theme-border bg-theme-bg/50 xl:w-[42%] xl:shrink-0 xl:border-b-0 xl:border-r",
            selectedCode ? "hidden xl:flex" : "flex",
          )}
        >
          {/* Header */}
          <div className="space-y-3 border-b border-theme-border bg-theme-card p-3.5 sm:p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="flex items-center gap-2 text-base font-bold text-theme-text sm:text-lg">
                  <Trophy className="h-5 w-5 shrink-0 text-amber-500" />
                  Applicant Leaderboard
                </h1>
                <p className="mt-0.5 text-xs text-theme-text-sec">
                  Ranked by referral points
                </p>
              </div>

              <button
                type="button"
                onClick={triggerScoringSweep}
                disabled={isScoring}
                title="Force re-score all milestones now"
                aria-label="Re-score referral milestones"
                className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-theme-border px-2.5 py-1.5 text-xs font-semibold text-theme-text-sec transition-colors hover:bg-theme-bg hover:text-theme-text disabled:cursor-wait disabled:opacity-50"
              >
                <RefreshCw
                  className={cn(
                    "h-4 w-4",
                    isScoring ? "animate-spin text-blue-500" : "",
                  )}
                />
                <span className="hidden sm:inline">
                  {isScoring ? "Scoring..." : "Re-score"}
                </span>
              </button>
            </div>

            {scoringMsg && (
              <div
                role="status"
                className="rounded-lg border border-blue-500/20 bg-blue-500/10 px-2.5 py-1.5 text-xs font-medium text-blue-600"
              >
                {scoringMsg}
              </div>
            )}

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-theme-text-sec" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search applicant, email, or code..."
                aria-label="Search applicants by name, email, or code"
                className="w-full rounded-xl border border-theme-border bg-theme-bg py-2 pl-9 pr-9 text-sm text-theme-text placeholder:text-theme-text-sec focus:border-blue-500 focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded-full p-1 text-theme-text-sec transition-colors hover:bg-theme-card hover:text-theme-text"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Leaderboard List */}
          <div className="divide-y divide-theme-border/40 xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:overscroll-contain">
            {filteredCodes.length === 0 ? (
              <div className="p-8 text-center text-theme-text-sec">
                <Users className="mx-auto mb-3 h-8 w-8 opacity-20" />
                <p className="text-sm font-medium">
                  {searchQuery
                    ? "No applicants match your search."
                    : "No referral codes found."}
                </p>
                <p className="mt-1 text-xs text-theme-text-sec">
                  {searchQuery
                    ? "Try a different name, email, or code."
                    : "Codes will appear here once seeded from CSV or created."}
                </p>
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="mt-3 cursor-pointer text-xs font-semibold text-blue-600 hover:underline"
                  >
                    Clear search
                  </button>
                )}
              </div>
            ) : (
              filteredCodes.map((item) => {
                const isSelected = item.code === selectedCode;
                const rank = rankByCode.get(item.code) ?? 0;

                return (
                  <button
                    key={item.id || item.code}
                    type="button"
                    onClick={() => setSelectedCode(item.code)}
                    aria-current={isSelected ? "true" : undefined}
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-3 border-l-4 border-l-transparent p-3.5 text-left transition-colors hover:bg-theme-bg sm:gap-3.5 sm:p-4",
                      isSelected ? "border-l-blue-500 bg-theme-bg" : "",
                    )}
                  >
                    {/* Rank Badge */}
                    <div className="w-7 shrink-0 text-center text-sm font-bold">
                      {rank === 1
                        ? "🥇"
                        : rank === 2
                          ? "🥈"
                          : rank === 3
                            ? "🥉"
                            : `#${rank}`}
                    </div>

                    {/* Applicant & Code */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="block min-w-0 truncate text-sm font-semibold text-theme-text">
                          {item.applicantName}
                        </span>
                        {!item.isActive && (
                          <span className="rounded bg-zinc-500/10 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">
                            Paused
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-theme-text-sec">
                        <span className="rounded border border-theme-border/60 bg-theme-card px-1.5 py-0.5 font-mono text-[11px] font-medium text-theme-text">
                          {item.code}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{item.totalSignups || 0} signups</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-medium text-emerald-600 dark:text-emerald-400">
                          {item.qualifiedSignups || 0} onboarded
                        </span>
                      </div>
                    </div>

                    {/* Score Tag */}
                    <div className="shrink-0 text-right">
                      <div className="text-base font-bold leading-tight text-blue-600">
                        {item.totalScore || 0}
                      </div>
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-theme-text-sec">
                        pts
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>

        {/* Right Pane - Detail Breakdown */}
        <section
          ref={detailRef}
          aria-label="Applicant referral details"
          className={cn(
            "flex w-full flex-col bg-theme-bg xl:w-auto xl:min-h-0 xl:min-w-0 xl:flex-1",
            !selectedCode ? "hidden xl:flex" : "flex",
          )}
        >
          {activeCodeObj ? (
            <>
              {/* Detail Header */}
              <div className="space-y-3 border-b border-theme-border bg-theme-card p-3.5 sm:p-4 md:p-5 md:space-y-4">
                <div className="flex items-start justify-between gap-2 sm:gap-3">
                  <div className="flex min-w-0 items-start gap-2 sm:gap-3">
                    <button
                      type="button"
                      onClick={goBackToList}
                      aria-label="Back to leaderboard"
                      className="-ml-1 mt-0.5 shrink-0 cursor-pointer rounded-lg p-1.5 text-theme-text-sec hover:bg-theme-bg xl:hidden"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <h2 className="max-w-full truncate text-base font-bold text-theme-text sm:text-lg">
                          {activeCodeObj.applicantName}
                        </h2>
                        <span className="rounded-md border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 font-mono text-xs font-semibold text-blue-600">
                          {activeCodeObj.code}
                        </span>
                      </div>
                      {activeCodeObj.applicantEmail && (
                        <p
                          className="mt-0.5 truncate text-xs text-theme-text-sec"
                          title={activeCodeObj.applicantEmail}
                        >
                          {activeCodeObj.applicantEmail}
                        </p>
                      )}
                      {(activeCodeObj.applicantAge ||
                        activeCodeObj.applicantLinkedinUrl) && (
                        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-theme-text-sec">
                          {activeCodeObj.applicantAge ? (
                            <span>Age {activeCodeObj.applicantAge}</span>
                          ) : null}
                          {activeCodeObj.applicantLinkedinUrl ? (
                            <a
                              href={activeCodeObj.applicantLinkedinUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 font-medium text-blue-600 hover:underline"
                            >
                              LinkedIn
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : null}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Copy Link Button */}
                  <button
                    type="button"
                    onClick={() => copyReferralLink(activeCodeObj.code)}
                    aria-label="Copy referral link"
                    className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-theme-border bg-theme-bg px-2.5 py-1.5 text-xs font-semibold text-theme-text transition-all hover:bg-theme-card-sec sm:px-3"
                  >
                    {copiedCode === activeCodeObj.code ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                        <span className="hidden text-emerald-500 sm:inline">
                          Copied!
                        </span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Copy Link</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Score & Conversion Stat Cards */}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-2.5">
                  <StatCard
                    label="Score"
                    value={activeCodeObj.totalScore || 0}
                    valueClassName="text-blue-600"
                  />
                  <StatCard
                    label="Signups"
                    value={activeCodeObj.totalSignups || 0}
                  />
                  <StatCard
                    label="Onboarded"
                    value={activeCodeObj.qualifiedSignups || 0}
                    valueClassName="text-emerald-600 dark:text-emerald-400"
                  />
                  <StatCard
                    label="Conversion"
                    value={
                      activeCodeObj.totalSignups > 0
                        ? `${Math.round(
                            ((activeCodeObj.qualifiedSignups || 0) /
                              activeCodeObj.totalSignups) *
                              100,
                          )}%`
                        : "0%"
                    }
                  />
                </div>
              </div>

              {/* Attributed Users & Milestone List */}
              <div className="flex-1 space-y-3 p-3.5 sm:p-4 md:p-5 xl:min-h-0 xl:overflow-y-auto xl:overscroll-contain">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-theme-text-sec">
                    Attributed Users{" "}
                    <span className="text-theme-text">({events.length})</span>
                  </h3>
                  <span className="text-[10px] text-theme-text-sec sm:text-[11px]">
                    Max {MAX_POINTS} points per user
                  </span>
                </div>

                {loadingEvents ? (
                  <div className="flex justify-center py-12">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-theme-border border-t-blue-500" />
                  </div>
                ) : events.length === 0 ? (
                  <div className="rounded-xl border border-theme-border bg-theme-card p-6 text-center text-theme-text-sec sm:p-8">
                    <Users className="mx-auto mb-2 h-8 w-8 opacity-30" />
                    <p className="text-sm font-medium">
                      No users attributed yet
                    </p>
                    <p className="mt-1 text-xs text-theme-text-sec">
                      When someone signs up via this applicant&apos;s link, they
                      will appear here.
                    </p>
                  </div>
                ) : (
                  events.map((ev) => {
                    const m = ev.milestones || {};
                    const score = Number(ev.score) || 0;
                    const progress = Math.min(
                      100,
                      Math.max(0, (score / MAX_POINTS) * 100),
                    );
                    const flag = ev._disqualifyReason
                      ? formatFlagReason(ev._disqualifyReason)
                      : null;

                    return (
                      <article
                        key={ev.id || ev.uid}
                        className={cn(
                          "space-y-3 rounded-xl border bg-theme-card p-3.5 shadow-xs sm:p-4",
                          flag
                            ? "border-amber-500/40"
                            : "border-theme-border",
                        )}
                      >
                        {/* User Header */}
                        <div className="flex items-start justify-between gap-2 sm:gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 items-center gap-2">
                              <span
                                className="min-w-0 truncate text-sm font-semibold text-theme-text"
                                title={ev.referredEmail || ev.uid}
                              >
                                {eventUserLabel(ev)}
                              </span>
                            </div>

                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                              <span
                                className={cn(
                                  "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                                  ev.signupMethod === "Google"
                                    ? "border-red-500/20 bg-red-500/10 text-red-600"
                                    : "border-blue-500/20 bg-blue-500/10 text-blue-600",
                                )}
                              >
                                {ev.signupMethod || "Email"}
                              </span>

                              {flag && (
                                <span
                                  title="Flagged accounts do not earn referral points"
                                  className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600"
                                >
                                  <AlertTriangle className="h-3 w-3" />
                                  {flag}
                                </span>
                              )}

                              {ev.attributedAt > 0 && (
                                <span className="text-[10px] text-theme-text-sec">
                                  Joined{" "}
                                  {formatTimestamp(ev.attributedAt, "MMM d, yyyy")}
                                </span>
                              )}
                            </div>
                          </div>

                          <span className="shrink-0 rounded-md bg-blue-500/10 px-2 py-0.5 text-xs font-bold text-blue-600">
                            {score} / {MAX_POINTS} pts
                          </span>
                        </div>

                        {/* Progress + Milestones */}
                        <div className="space-y-2.5 border-t border-theme-border/40 pt-2.5">
                          <div
                            className="h-1.5 overflow-hidden rounded-full bg-theme-border/40"
                            title={`${score} of ${MAX_POINTS} points`}
                          >
                            <div
                              className="h-full rounded-full bg-blue-500 transition-all"
                              style={{ width: `${progress}%` }}
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                            {MILESTONES.map((milestone) => (
                              <MilestoneBadge
                                key={milestone.key}
                                label={milestone.label}
                                points={milestone.points}
                                milestone={m[milestone.key]}
                              />
                            ))}
                          </div>
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-theme-text-sec">
              <Trophy className="mb-3 h-12 w-12 opacity-20" />
              <p className="text-sm font-medium">Select an applicant</p>
              <p className="mt-1 max-w-xs text-xs">
                Choose someone from the leaderboard to see their referral
                breakdown.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
