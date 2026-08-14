import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import {
  Mail, ArrowLeft, TrendingUp, Users, CheckCircle,
  XCircle, Clock, Activity, AlertCircle, PauseCircle,
  RefreshCw, Send
} from "lucide-react";
import Navigation from "@/components/navigation";
import Footer from "@/components/footer";

type Period = "day" | "week" | "month" | "ytd";

type AnalyticsData = {
  period: string;
  fromDate: string;
  summary: { total: number; sent: number; failed: number; opened: number; replied: number; totalStepsSent?: number };
  bySender: { senderName: string; total: number; sent: number; failed: number; opened: number; replied: number }[];
  dailyVolume: { date: string; sent: number; failed: number }[];
  senders: { name: string; email: string; dailyLimit: number; warmupStage: number | null; paused: boolean; sentToday: number }[];
};

type EnrollmentStats = {
  pending: number; in_progress: number; completed: number; failed: number;
  dueNow: number; dueToday: number; total: number;
};

const pct = (n: number, d: number) => d > 0 ? `${((n / d) * 100).toFixed(1)}%` : "—";
const fmtDate = (d: string) => {
  if (!d) return "";
  const dt = new Date(d);
  return `${dt.getMonth() + 1}/${dt.getDate()}`;
};

function StatCard({ icon, label, value, sub, color }: { icon: any; label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex items-start gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
        {icon}
      </div>
      <div>
        <div className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-0.5">{label}</div>
        <div className="text-2xl font-bold text-gray-900 leading-tight">{value}</div>
        {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

export default function OutreachAnalyticsPage() {
  const [period, setPeriod] = useState<Period>("month");

  const { data, isLoading, refetch, isRefetching } = useQuery<AnalyticsData>({
    queryKey: ["/api/outreach/email-analytics", period],
    queryFn: () => fetch(`/api/outreach/email-analytics?period=${period}`).then(r => r.json()),
    staleTime: 60_000,
  });

  const { data: enrollment } = useQuery<EnrollmentStats>({
    queryKey: ["/api/outreach/enrollment-stats"],
    staleTime: 60_000,
  });

  const summary = data?.summary;
  const hasActivity = (summary?.sent ?? 0) > 0 || (summary?.total ?? 0) > 0;

  const PERIODS: { label: string; value: Period }[] = [
    { label: "Today", value: "day" },
    { label: "7 Days", value: "week" },
    { label: "30 Days", value: "month" },
    { label: "YTD", value: "ytd" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navigation />
      <div className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/outreach-management">
              <a className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
                <ArrowLeft className="w-4 h-4" /> Outreach Management
              </a>
            </Link>
          </div>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 bg-white transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Mail className="w-6 h-6 text-blue-600" /> Outreach Analytics
          </h1>
          <p className="text-sm text-gray-500 mt-1">Email send activity, sender health, and drip campaign status</p>
        </div>

        {/* Period toggle */}
        <div className="flex gap-1 mb-8 bg-white border border-gray-200 rounded-lg p-1 w-fit shadow-sm">
          {PERIODS.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                period === p.value
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon={<Send className="w-5 h-5 text-blue-600" />}
            label="Emails Sent"
            value={isLoading ? "…" : (summary?.totalStepsSent ?? summary?.sent ?? 0).toLocaleString()}
            sub={`${(summary?.failed ?? 0)} failed · ${(summary?.sent ?? 0)} contacts reached`}
            color="bg-blue-50"
          />
          <StatCard
            icon={<TrendingUp className="w-5 h-5 text-emerald-600" />}
            label="Contacts Reached"
            value={isLoading ? "…" : (summary?.sent ?? 0).toLocaleString()}
            sub="Unique contacts emailed"
            color="bg-emerald-50"
          />
          <StatCard
            icon={<Activity className="w-5 h-5 text-violet-600" />}
            label="Avg Steps / Contact"
            value={isLoading ? "…" : ((summary?.sent ?? 0) > 0 ? ((summary?.totalStepsSent ?? 0) / (summary?.sent ?? 1)).toFixed(1) : "—")}
            sub="Email steps per enrolled contact"
            color="bg-violet-50"
          />
          <StatCard
            icon={<Users className="w-5 h-5 text-amber-600" />}
            label="In Drip Sequences"
            value={isLoading ? "…" : (enrollment?.total ?? 0).toLocaleString()}
            sub={`${enrollment?.dueToday ?? 0} due today`}
            color="bg-amber-50"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">

          {/* Daily volume chart */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <BarChart className="w-4 h-4 text-blue-500" />
              Daily Send Volume
            </h2>
            {isLoading ? (
              <div className="h-48 flex items-center justify-center text-gray-400 text-sm">Loading…</div>
            ) : !hasActivity || (data?.dailyVolume?.length ?? 0) === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center gap-2 text-center">
                <AlertCircle className="w-8 h-8 text-gray-300" />
                <p className="text-sm text-gray-400">No send data for this period yet.</p>
                <p className="text-xs text-gray-300">Data will appear here once campaigns start sending.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data!.dailyVolume.map(d => ({ ...d, date: fmtDate(String(d.date)) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="sent" name="Sent" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="failed" name="Failed" fill="#f87171" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Drip enrollment status */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              Drip Enrollment Status
            </h2>
            <div className="space-y-3">
              {[
                { label: "Pending", value: enrollment?.pending ?? 0, icon: <Clock className="w-3.5 h-3.5 text-amber-500" />, color: "text-amber-700 bg-amber-50" },
                { label: "In Progress", value: enrollment?.in_progress ?? 0, icon: <Activity className="w-3.5 h-3.5 text-blue-500" />, color: "text-blue-700 bg-blue-50" },
                { label: "Completed", value: enrollment?.completed ?? 0, icon: <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />, color: "text-emerald-700 bg-emerald-50" },
                { label: "Failed", value: enrollment?.failed ?? 0, icon: <XCircle className="w-3.5 h-3.5 text-red-500" />, color: "text-red-700 bg-red-50" },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    {row.icon} {row.label}
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${row.color}`}>
                    {row.value.toLocaleString()}
                  </span>
                </div>
              ))}
              <div className="border-t border-gray-100 pt-3 mt-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 font-medium">Due today</span>
                  <span className="font-bold text-gray-800">{(enrollment?.dueToday ?? 0).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-sm mt-1">
                  <span className="text-gray-500 font-medium">Due now</span>
                  <span className={`font-bold ${(enrollment?.dueNow ?? 0) > 0 ? "text-amber-600" : "text-gray-800"}`}>
                    {(enrollment?.dueNow ?? 0).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sender breakdown table */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm mb-6">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Users className="w-4 h-4 text-violet-500" />
              Per-Sender Breakdown
            </h2>
            <span className="text-xs text-gray-400">Open/reply tracking not available via Microsoft Graph</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  {["Sender", "Contacts Reached", "Sent Successfully", "Failed"].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400">Loading…</td></tr>
                ) : (data?.bySender?.length ?? 0) === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <AlertCircle className="w-6 h-6 text-gray-300" />
                        <span className="text-sm text-gray-400">No messages sent in this period yet</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  data!.bySender.map((row, i) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-sm text-gray-800">{row.senderName || "Unassigned"}</td>
                      <td className="px-4 py-3 text-sm text-blue-700 font-medium">{row.sent.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                          <CheckCircle className="w-3 h-3" />{row.sent.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {row.failed > 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                            <XCircle className="w-3 h-3" />{row.failed}
                          </span>
                        ) : <span className="text-xs text-gray-400">—</span>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sender health panel */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-500" />
              Sender Health &amp; Daily Limits
            </h2>
          </div>
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {isLoading ? (
              <div className="col-span-4 text-center py-6 text-sm text-gray-400">Loading…</div>
            ) : (data?.senders?.length ?? 0) === 0 ? (
              <div className="col-span-4 text-center py-6 text-sm text-gray-400">No active senders configured</div>
            ) : (
              data!.senders.map((s, i) => {
                const used = s.sentToday;
                const limit = s.dailyLimit;
                const pctUsed = Math.min(100, limit > 0 ? (used / limit) * 100 : 0);
                return (
                  <div key={i} className={`rounded-xl border p-4 ${s.paused ? "border-amber-200 bg-amber-50" : "border-gray-100 bg-gray-50"}`}>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="font-semibold text-sm text-gray-800">{s.name}</div>
                        <div className="text-xs text-gray-400">{s.email}</div>
                      </div>
                      {s.paused ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded-full">
                          <PauseCircle className="w-2.5 h-2.5" /> Paused
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">
                          <CheckCircle className="w-2.5 h-2.5" /> Active
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>Today: <strong className="text-gray-800">{used}</strong> / {limit}</span>
                      {s.warmupStage != null && <span className="text-blue-600">Warmup #{s.warmupStage}</span>}
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full transition-all ${pctUsed >= 90 ? "bg-red-500" : pctUsed >= 60 ? "bg-amber-400" : "bg-blue-500"}`}
                        style={{ width: `${pctUsed}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>
      <Footer />
    </div>
  );
}
