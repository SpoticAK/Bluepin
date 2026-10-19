import React, { useEffect, useState, useMemo } from "react";
import {
  Trophy,
  Users,
  Search,
  RefreshCw,
  Copy,
  Check,
  ChevronLeft,
  Award,
  Activity,
  FileText,
  MessageCircle,
  Calendar,
  CheckCircle2,
  Circle,
  ShieldCheck,
  ExternalLink,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "../lib/utils";
import { auth } from "../lib/firebase";

interface ReferralCodeItem {
  id: string;
  code: string;
  applicantName: string;
  applicantEmail?: string | null;
  isActive: boolean;
  totalSignups: number;
  qualifiedSignups: number;
  totalScore: number;
  createdAt?: number;
}

interface ReferralMilestone {
  achievedAt: number;
}

interface ReferralEventItem {
  id: string;
  uid: string;
  refCode: string;
  attributedAt: number;
  signupMethod: "Email" | "Google";
  score: number;
  lastScoredAt?: number;
  milestones?: {
    onboarded?: ReferralMilestone;
    glucose3days?: ReferralMilestone;
    labReportUploaded?: ReferralMilestone;
    whatsappLinked?: ReferralMilestone;
    active7days?: ReferralMilestone;
  };
  _disqualifyReason?: string;
}

export default function AdminReferralView() {
  const [codes, setCodes] = useState<ReferralCodeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [events, setEvents] = useState<ReferralEventItem[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [isScoring, setIsScoring] = useState(false);
  const [scoringMsg, setScoringMsg] = useState<string | null>(null);

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
        if (data.codes?.length > 0 && !selectedCode) {
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

      const res = await fetch(`/api/referrals/admin/summary?code=${encodeURIComponent(code)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
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
      const res = await fetch("/api/cron/referral-scoring?force=true", {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        setScoringMsg(`Scored ${data.processed} users (+${data.pointsAwardedTotal} pts awarded)`);
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
    if (selectedCode) {
      fetchCodeDetails(selectedCode);
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

  const activeCodeObj = useMemo(
    () => codes.find((c) => c.code === selectedCode),
    [codes, selectedCode],
  );

  const copyReferralLink = (code: string) => {
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/?ref=${code}&utm_source=applicant&utm_medium=referral&utm_campaign=hiring_test`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  if (loading && codes.length === 0) {
    return (
      <div className="w-full max-w-4xl mx-auto py-12 flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-theme-border border-t-blue-500 animate-spin" />
        <p className="text-sm text-theme-text-sec">Loading referral leaderboard...</p>
      </div>
    );
  }

  return (
    <div className="w-full h-[calc(100vh-8rem)] max-w-6xl mx-auto py-4 px-4 sm:px-6">
      <div className="bg-theme-card border border-theme-border rounded-2xl h-full flex overflow-hidden shadow-sm">
        
        {/* Left Pane - Leaderboard */}
        <div
          className={cn(
            "w-full md:w-5/12 flex flex-col border-r border-theme-border bg-theme-bg/50",
            selectedCode ? "hidden md:flex" : "flex",
          )}
        >
          {/* Header */}
          <div className="p-4 border-b border-theme-border bg-theme-card space-y-3">
            <div className="flex items-center justify-between">
              <h1 className="text-lg font-bold text-theme-text flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-500" />
                Applicant Leaderboard
              </h1>
              <div className="flex items-center gap-2">
                <button
                  onClick={triggerScoringSweep}
                  disabled={isScoring}
                  title="Force re-score all milestones now"
                  className="p-1.5 rounded-lg border border-theme-border hover:bg-theme-bg text-theme-text-sec hover:text-theme-text transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={cn("w-4 h-4", isScoring ? "animate-spin text-blue-500" : "")} />
                </button>
              </div>
            </div>

            {scoringMsg && (
              <div className="text-xs px-2.5 py-1.5 rounded-lg bg-blue-500/10 text-blue-600 border border-blue-500/20 font-medium">
                {scoringMsg}
              </div>
            )}

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-theme-text-sec" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search applicant or code..."
                className="w-full pl-9 pr-3 py-1.5 text-sm bg-theme-bg border border-theme-border rounded-xl text-theme-text placeholder:text-theme-text-sec focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Leaderboard List */}
          <div className="flex-1 overflow-y-auto divide-y divide-theme-border/40">
            {filteredCodes.length === 0 ? (
              <div className="p-8 text-center text-theme-text-sec">
                <Users className="w-8 h-8 mx-auto mb-3 opacity-20" />
                <p className="text-sm font-medium">No referral codes found.</p>
                <p className="text-xs text-theme-text-sec mt-1">
                  Codes will appear here once seeded from CSV or created.
                </p>
              </div>
            ) : (
              filteredCodes.map((item, index) => {
                const isSelected = item.code === selectedCode;
                const isTop1 = index === 0 && !searchQuery;
                const isTop2 = index === 1 && !searchQuery;
                const isTop3 = index === 2 && !searchQuery;

                return (
                  <button
                    key={item.id || item.code}
                    onClick={() => setSelectedCode(item.code)}
                    className={cn(
                      "w-full p-4 flex items-center gap-3.5 text-left transition-colors hover:bg-theme-bg cursor-pointer",
                      isSelected ? "bg-theme-bg border-l-4 border-l-blue-500 pl-3" : "",
                    )}
                  >
                    {/* Rank Badge */}
                    <div className="w-7 text-center font-bold text-sm shrink-0">
                      {isTop1 ? "🥇" : isTop2 ? "🥈" : isTop3 ? "🥉" : `#${index + 1}`}
                    </div>

                    {/* Applicant & Code */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-semibold text-sm text-theme-text truncate block">
                          {item.applicantName}
                        </span>
                        {!item.isActive && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-500/10 text-zinc-500 font-medium">
                            Paused
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-theme-text-sec">
                        <span className="font-mono bg-theme-card px-1.5 py-0.5 rounded border border-theme-border/60 text-[11px] text-theme-text font-medium">
                          {item.code}
                        </span>
                        <span>•</span>
                        <span>{item.totalSignups || 0} signups</span>
                        <span>•</span>
                        <span className="text-emerald-600 font-medium">{item.qualifiedSignups || 0} onboarded</span>
                      </div>
                    </div>

                    {/* Score Tag */}
                    <div className="text-right shrink-0">
                      <div className="text-base font-bold text-blue-600">
                        {item.totalScore || 0}
                      </div>
                      <div className="text-[10px] text-theme-text-sec uppercase tracking-wider font-semibold">
                        points
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Pane - Detail Breakdown */}
        <div
          className={cn(
            "w-full md:w-7/12 flex flex-col bg-theme-bg",
            !selectedCode ? "hidden md:flex" : "flex",
          )}
        >
          {activeCodeObj ? (
            <>
              {/* Detail Header */}
              <div className="p-4 md:p-5 border-b border-theme-border bg-theme-card space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setSelectedCode(null)}
                      className="md:hidden p-1.5 -ml-2 rounded-lg hover:bg-theme-bg text-theme-text-sec"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-bold text-theme-text">
                          {activeCodeObj.applicantName}
                        </h2>
                        <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 border border-blue-500/20">
                          {activeCodeObj.code}
                        </span>
                      </div>
                      {activeCodeObj.applicantEmail && (
                        <p className="text-xs text-theme-text-sec mt-0.5">
                          {activeCodeObj.applicantEmail}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Copy Link Button */}
                  <button
                    onClick={() => copyReferralLink(activeCodeObj.code)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-theme-bg border border-theme-border hover:bg-theme-card-sec text-theme-text transition-all cursor-pointer"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="text-emerald-500">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Link</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Score & Conversion Stat Cards */}
                <div className="grid grid-cols-4 gap-2.5">
                  <div className="bg-theme-bg border border-theme-border/60 rounded-xl p-2.5 text-center">
                    <span className="text-[10px] text-theme-text-sec uppercase tracking-wider font-semibold block mb-0.5">
                      Score
                    </span>
                    <span className="text-lg font-bold text-blue-600 block">
                      {activeCodeObj.totalScore || 0}
                    </span>
                  </div>

                  <div className="bg-theme-bg border border-theme-border/60 rounded-xl p-2.5 text-center">
                    <span className="text-[10px] text-theme-text-sec uppercase tracking-wider font-semibold block mb-0.5">
                      Signups
                    </span>
                    <span className="text-lg font-bold text-theme-text block">
                      {activeCodeObj.totalSignups || 0}
                    </span>
                  </div>

                  <div className="bg-theme-bg border border-theme-border/60 rounded-xl p-2.5 text-center">
                    <span className="text-[10px] text-theme-text-sec uppercase tracking-wider font-semibold block mb-0.5">
                      Onboarded
                    </span>
                    <span className="text-lg font-bold text-emerald-600 block">
                      {activeCodeObj.qualifiedSignups || 0}
                    </span>
                  </div>

                  <div className="bg-theme-bg border border-theme-border/60 rounded-xl p-2.5 text-center">
                    <span className="text-[10px] text-theme-text-sec uppercase tracking-wider font-semibold block mb-0.5">
                      Conversion
                    </span>
                    <span className="text-lg font-bold text-theme-text block">
                      {activeCodeObj.totalSignups > 0
                        ? `${Math.round(((activeCodeObj.qualifiedSignups || 0) / activeCodeObj.totalSignups) * 100)}%`
                        : "0%"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Attributed Users & Milestone List */}
              <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-theme-text-sec">
                    Attributed Users ({events.length})
                  </h3>
                  <span className="text-[11px] text-theme-text-sec">
                    Max 9 points per user
                  </span>
                </div>

                {loadingEvents ? (
                  <div className="py-12 flex justify-center">
                    <div className="w-6 h-6 rounded-full border-2 border-theme-border border-t-blue-500 animate-spin" />
                  </div>
                ) : events.length === 0 ? (
                  <div className="p-8 text-center text-theme-text-sec bg-theme-card border border-theme-border rounded-xl">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm font-medium">No users attributed yet</p>
                    <p className="text-xs text-theme-text-sec mt-1">
                      When someone signs up via this applicant's link, they will appear here.
                    </p>
                  </div>
                ) : (
                  events.map((ev) => {
                    const m = ev.milestones || {};
                    return (
                      <div
                        key={ev.id || ev.uid}
                        className="bg-theme-card border border-theme-border rounded-xl p-3.5 space-y-3 shadow-xs"
                      >
                        {/* User Header */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-theme-text font-semibold">
                              {ev.uid ? `u_${ev.uid.slice(0, 8)}...` : "Unknown"}
                            </span>
                            <span
                              className={cn(
                                "text-[10px] px-2 py-0.5 rounded-full font-medium border",
                                ev.signupMethod === "Google"
                                  ? "bg-red-500/10 text-red-600 border-red-500/20"
                                  : "bg-blue-500/10 text-blue-600 border-blue-500/20",
                              )}
                            >
                              {ev.signupMethod || "Email"}
                            </span>
                            {ev._disqualifyReason && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20 font-medium">
                                Flagged: {ev._disqualifyReason}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-blue-600 bg-blue-500/10 px-2 py-0.5 rounded-md">
                              {ev.score || 0} / 9 pts
                            </span>
                            <span className="text-[10px] text-theme-text-sec">
                              {ev.attributedAt ? format(new Date(ev.attributedAt), "MMM d") : ""}
                            </span>
                          </div>
                        </div>

                        {/* Milestones Checklist */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 border-t border-theme-border/40 text-xs">
                          {/* Milestone 1: Onboarded */}
                          <div
                            className={cn(
                              "flex items-center gap-1.5 px-2 py-1.5 rounded-lg border",
                              m.onboarded
                                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400"
                                : "bg-theme-bg border-theme-border/50 text-theme-text-sec opacity-60",
                            )}
                          >
                            {m.onboarded ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            ) : (
                              <Circle className="w-3.5 h-3.5 shrink-0" />
                            )}
                            <span className="truncate">Onboarded (+1)</span>
                          </div>

                          {/* Milestone 2: Glucose 3 days */}
                          <div
                            className={cn(
                              "flex items-center gap-1.5 px-2 py-1.5 rounded-lg border",
                              m.glucose3days
                                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400"
                                : "bg-theme-bg border-theme-border/50 text-theme-text-sec opacity-60",
                            )}
                          >
                            {m.glucose3days ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            ) : (
                              <Circle className="w-3.5 h-3.5 shrink-0" />
                            )}
                            <span className="truncate">Glucose 3d (+2)</span>
                          </div>

                          {/* Milestone 3: Lab report */}
                          <div
                            className={cn(
                              "flex items-center gap-1.5 px-2 py-1.5 rounded-lg border",
                              m.labReportUploaded
                                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400"
                                : "bg-theme-bg border-theme-border/50 text-theme-text-sec opacity-60",
                            )}
                          >
                            {m.labReportUploaded ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            ) : (
                              <Circle className="w-3.5 h-3.5 shrink-0" />
                            )}
                            <span className="truncate">Lab Report (+2)</span>
                          </div>

                          {/* Milestone 4: WhatsApp */}
                          <div
                            className={cn(
                              "flex items-center gap-1.5 px-2 py-1.5 rounded-lg border",
                              m.whatsappLinked
                                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400"
                                : "bg-theme-bg border-theme-border/50 text-theme-text-sec opacity-60",
                            )}
                          >
                            {m.whatsappLinked ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            ) : (
                              <Circle className="w-3.5 h-3.5 shrink-0" />
                            )}
                            <span className="truncate">WhatsApp (+1)</span>
                          </div>

                          {/* Milestone 5: Active 7 days */}
                          <div
                            className={cn(
                              "flex items-center gap-1.5 px-2 py-1.5 rounded-lg border",
                              m.active7days
                                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400"
                                : "bg-theme-bg border-theme-border/50 text-theme-text-sec opacity-60",
                            )}
                          >
                            {m.active7days ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            ) : (
                              <Circle className="w-3.5 h-3.5 shrink-0" />
                            )}
                            <span className="truncate">Active 7d (+3)</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-theme-text-sec p-8">
              <Trophy className="w-12 h-12 mb-3 opacity-20" />
              <p className="font-medium text-sm">Select an applicant to view breakdown</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
