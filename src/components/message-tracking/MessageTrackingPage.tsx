import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCheck, Check, Send, XCircle, CircleDashed, RefreshCw, MessageSquare } from 'lucide-react';
import type { Vehicle } from '@/types/fleet';
import { hasReported } from '@/lib/analytics';
import {
  fetchMessageLog,
  phoneKey,
  effectiveStatus,
  reachedDriver,
  type MessageLogRow,
  type EffectiveStatus,
} from '@/lib/messageLog';

interface MessageTrackingPageProps {
  vehicles: Vehicle[];
  selectedYear: string;
  selectedMonth: number;
}

const MONTH_NAMES: Record<number, string> = {
  1: 'ינואר', 2: 'פברואר', 3: 'מרץ', 4: 'אפריל',
  5: 'מאי', 6: 'יוני', 7: 'יולי', 8: 'אוגוסט',
  9: 'ספטמבר', 10: 'אוקטובר', 11: 'נובמבר', 12: 'דצמבר',
};

// תצוגת כל סטטוס אפקטיבי: אייקון, טקסט, וצבע.
const STATUS_UI: Record<EffectiveStatus, { label: string; color: string; bg: string; Icon: typeof Check }> = {
  read: { label: 'נקרא', color: '#34c759', bg: 'rgba(52,199,89,0.12)', Icon: CheckCheck },
  delivered: { label: 'נמסר', color: '#34c759', bg: 'rgba(52,199,89,0.12)', Icon: CheckCheck },
  sent: { label: 'נשלח', color: '#007AFF', bg: 'rgba(0,122,255,0.10)', Icon: Send },
  failed: { label: 'נכשל', color: '#ff3b30', bg: 'rgba(255,59,48,0.12)', Icon: XCircle },
  not_sent: { label: 'לא נשלח', color: '#86868b', bg: 'rgba(134,134,139,0.12)', Icon: CircleDashed },
};

function StatusChip({ status, title }: { status: EffectiveStatus; title?: string }) {
  const ui = STATUS_UI[status];
  const Icon = ui.Icon;
  return (
    <span
      title={title}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ color: ui.color, backgroundColor: ui.bg }}
    >
      <Icon className="w-3.5 h-3.5" />
      {ui.label}
    </span>
  );
}

interface DriverRow {
  key: string;
  driverName: string;
  plates: string[];
  reported: boolean;
  monthOpen: EffectiveStatus;
  reminder: EffectiveStatus;
  monthOpenError: string | null;
}

export function MessageTrackingPage({ vehicles, selectedYear, selectedMonth }: MessageTrackingPageProps) {
  const yearNum = Number(selectedYear);

  const { data: logRows = [], isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['message-log', yearNum, selectedMonth],
    queryFn: () => fetchMessageLog(yearNum, selectedMonth),
    staleTime: 30_000,
  });

  const rows = useMemo<DriverRow[]>(() => {
    // אינדקס שורות היומן לפי (מפתח-טלפון, סוג).
    const byKey = new Map<string, Partial<Record<string, MessageLogRow>>>();
    for (const r of logRows) {
      const k = phoneKey(r.phone);
      if (!k) continue;
      const bucket = byKey.get(k) ?? {};
      bucket[r.kind] = r;
      byKey.set(k, bucket);
    }

    // איחוד רכבים פר-נהג (לפי מפתח-טלפון).
    const byDriver = new Map<string, DriverRow>();
    for (const v of vehicles) {
      const k = phoneKey(v.phone);
      if (!k) continue;
      const bucket = byKey.get(k) ?? {};
      const existing = byDriver.get(k);
      const reportedNow = hasReported(v, selectedYear, selectedMonth);
      if (existing) {
        if (v.plateNumber) existing.plates.push(v.plateNumber);
        existing.reported = existing.reported || reportedNow;
      } else {
        byDriver.set(k, {
          key: k,
          driverName: v.driverName || bucket.month_open?.driver_name || '—',
          plates: v.plateNumber ? [v.plateNumber] : [],
          reported: reportedNow,
          monthOpen: effectiveStatus(bucket.month_open),
          reminder: effectiveStatus(bucket.reminder),
          monthOpenError: bucket.month_open?.error ?? null,
        });
      }
    }
    return [...byDriver.values()].sort((a, b) => {
      // לא-נמסר קודם, כדי שהבעיות יקפצו למעלה.
      const rank = (s: EffectiveStatus) => (s === 'not_sent' ? 0 : s === 'failed' ? 1 : 2);
      return rank(a.monthOpen) - rank(b.monthOpen) || a.driverName.localeCompare(b.driverName, 'he');
    });
  }, [logRows, vehicles, selectedYear, selectedMonth]);

  const summary = useMemo(() => {
    const total = rows.length;
    let reached = 0, failed = 0, notSent = 0, delivered = 0;
    for (const r of rows) {
      if (reachedDriver(r.monthOpen)) reached++;
      if (r.monthOpen === 'failed') failed++;
      if (r.monthOpen === 'not_sent') notSent++;
      if (r.monthOpen === 'delivered' || r.monthOpen === 'read') delivered++;
    }
    return { total, reached, failed, notSent, delivered };
  }, [rows]);

  const periodLabel = `${MONTH_NAMES[selectedMonth] ?? selectedMonth} ${selectedYear}`;

  return (
    <div className="space-y-6">
      {/* כותרת */}
      <div className="glass-card rounded-[24px] p-5 lg:p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#25D366]/10 flex items-center justify-center">
              <MessageSquare className="w-6 h-6 text-[#25D366]" />
            </div>
            <div>
              <h1 className="text-xl lg:text-2xl font-extrabold text-[#1d1d1f]">מעקב הודעות לנהגים</h1>
              <p className="text-sm text-[#86868b]">
                מי קיבל את ההודעה החודשית והתזכורת עבור דיווח {periodLabel}
              </p>
            </div>
          </div>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-[14px] bg-white/50 hover:bg-white/70 text-sm font-medium text-[#424245] transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            רענון
          </button>
        </div>
      </div>

      {/* סיכום */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard label="קיבלו את ההודעה" value={`${summary.reached}/${summary.total}`} color="#34c759" hint="נמסר או נשלח" />
        <SummaryCard label="נמסרו בפועל" value={summary.delivered} color="#007AFF" hint="אישור מסירה מ-WhatsApp" />
        <SummaryCard label="נכשלו" value={summary.failed} color="#ff3b30" hint="שגיאת שליחה" />
        <SummaryCard label="לא נשלחו" value={summary.notSent} color="#86868b" hint="אין רישום שליחה" />
      </div>

      {/* טבלה */}
      <div className="glass-card rounded-[24px] overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center text-[#86868b]">טוען…</div>
        ) : isError ? (
          <div className="p-10 text-center text-[#ff3b30]">שגיאה בטעינת יומן ההודעות</div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-[#86868b]">אין נהגים להצגה לתקופה זו</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="text-[13px] text-[#86868b] border-b border-black/5">
                  <th className="py-3 px-4 font-semibold">נהג</th>
                  <th className="py-3 px-4 font-semibold">רכב</th>
                  <th className="py-3 px-4 font-semibold">הודעה בתחילת חודש</th>
                  <th className="py-3 px-4 font-semibold">תזכורת</th>
                  <th className="py-3 px-4 font-semibold">דיווח ק"מ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key} className="border-b border-black/[0.03] hover:bg-white/30 transition-colors">
                    <td className="py-3 px-4 font-semibold text-[#1d1d1f]">{r.driverName}</td>
                    <td className="py-3 px-4 text-sm text-[#424245]">
                      <bdi>{r.plates.join(', ') || '—'}</bdi>
                    </td>
                    <td className="py-3 px-4">
                      <StatusChip status={r.monthOpen} title={r.monthOpenError ?? undefined} />
                    </td>
                    <td className="py-3 px-4"><StatusChip status={r.reminder} /></td>
                    <td className="py-3 px-4">
                      {r.reported ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#34c759]">
                          <Check className="w-3.5 h-3.5" /> דיווח
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-[#ff9500]">טרם דיווח</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, color, hint }: { label: string; value: string | number; color: string; hint: string }) {
  return (
    <div className="glass-card rounded-[24px] p-5">
      <p className="text-sm text-[#86868b] mb-1">{label}</p>
      <p className="text-3xl font-extrabold" style={{ color }}>{value}</p>
      <p className="text-xs text-[#86868b] mt-1">{hint}</p>
    </div>
  );
}
