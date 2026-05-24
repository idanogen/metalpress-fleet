import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, CheckCircle, X, Loader2, Phone, Car, Calendar } from 'lucide-react';
import { fetchPendingAnomalies, resolveAnomaly, type PendingAnomaly } from '@/lib/anomalies';
import { VehicleImage } from '@/components/ui/VehicleImage';

const MONTH_NAMES: Record<number, string> = {
  1: 'ינואר', 2: 'פברואר', 3: 'מרץ', 4: 'אפריל',
  5: 'מאי', 6: 'יוני', 7: 'יולי', 8: 'אוגוסט',
  9: 'ספטמבר', 10: 'אוקטובר', 11: 'נובמבר', 12: 'דצמבר',
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('he-IL', {
    day: 'numeric', month: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function AnomaliesReviewPage() {
  const queryClient = useQueryClient();

  const { data: anomalies = [], isLoading, error } = useQuery<PendingAnomaly[]>({
    queryKey: ['pending-anomalies'],
    queryFn: fetchPendingAnomalies,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="glass-card p-5 lg:p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#ff9500]/10 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-[#ff9500]" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-[#1d1d1f]">דיווחים חריגים</h2>
              <p className="text-sm text-[#86868b] mt-1">
                דיווחי ק"מ שנפלו בולידציה (גבוה משמעותית או נמוך מהקודם) — מחכים לאישור או תיקון
              </p>
            </div>
            <div className="mr-auto">
              <div className="text-4xl font-extrabold text-[#ff9500]">{anomalies.length}</div>
              <div className="text-xs text-[#86868b] text-center">בהמתנה</div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Body */}
      {isLoading && (
        <div className="glass-card p-12 text-center">
          <Loader2 className="w-8 h-8 text-[#86868b] animate-spin mx-auto" />
        </div>
      )}

      {error && (
        <div className="glass-card p-6 text-center text-[#ff3b30]">
          שגיאה בטעינה: {String(error)}
        </div>
      )}

      {!isLoading && !error && anomalies.length === 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card p-12 text-center"
        >
          <CheckCircle className="w-16 h-16 text-[#34c759] mx-auto mb-4" />
          <h3 className="text-xl font-bold text-[#1d1d1f] mb-2">הכל נקי!</h3>
          <p className="text-sm text-[#86868b]">אין דיווחים חריגים בהמתנה</p>
        </motion.div>
      )}

      <AnimatePresence>
        {anomalies.map((item, idx) => (
          <AnomalyCard
            key={item.id}
            item={item}
            delay={idx * 0.05}
            onResolved={() => queryClient.invalidateQueries({ queryKey: ['pending-anomalies'] })}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

function AnomalyCard({
  item,
  delay,
  onResolved,
}: {
  item: PendingAnomaly;
  delay: number;
  onResolved: () => void;
}) {
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [correctedValue, setCorrectedValue] = useState<string>('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const mutation = useMutation({
    mutationFn: (vars: { action: 'approve' | 'reject'; corrected?: number }) =>
      resolveAnomaly(item.id, vars.action, vars.corrected),
    onSuccess: (result) => {
      const action = result.action === 'approve' ? 'אושר' : 'תוקן';
      const priorityMsg = result.priorityWritten
        ? '✅ פריוריטי עודכן'
        : '⚠️ צריך עדכון ידני בפריורטי';
      setFeedback({
        type: 'success',
        text: `${action} (${result.mileage.toLocaleString('he-IL')} ק"מ) — ${priorityMsg}`,
      });
      // Invalidate immediately so the row disappears as soon as the refetch returns;
      // the success toast remains visible on the card until then via local state.
      onResolved();
    },
    onError: (err) => {
      setFeedback({ type: 'error', text: `שגיאה: ${String(err)}` });
    },
  });

  const handleApprove = () => mutation.mutate({ action: 'approve' });
  const handleReject = () => {
    const n = Number(correctedValue);
    if (!Number.isFinite(n) || n <= 0) {
      setFeedback({ type: 'error', text: 'יש להזין מספר תקין' });
      return;
    }
    mutation.mutate({ action: 'reject', corrected: n });
  };

  const delta = item.vehicle && item.vehicle.current_mileage > 0
    ? item.parsed_mileage - item.vehicle.current_mileage
    : null;
  const monthLabel = MONTH_NAMES[item.parsed_month] || `חודש ${item.parsed_month}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay, duration: 0.4 }}
      className="glass-card overflow-hidden"
    >
      <div className="p-5 lg:p-6">
        {/* Top row: driver + vehicle + meta */}
        <div className="flex flex-wrap items-start gap-4">
          <VehicleImage model={item.vehicle?.model ?? ''} width={64} height={44} />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h3 className="text-lg font-bold text-[#1d1d1f]">{item.driver?.name ?? '—'}</h3>
              {item.driver?.phone && (
                <span className="text-xs text-[#86868b] flex items-center gap-1 font-mono direction-ltr">
                  <Phone className="w-3 h-3" />
                  {item.driver.phone}
                </span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[#424245]">
              <span className="flex items-center gap-1">
                <Car className="w-3.5 h-3.5 text-[#86868b]" />
                {item.vehicle?.model ?? '—'}
              </span>
              <span className="text-[#86868b] font-mono text-xs">{item.vehicle?.plate_number ?? '—'}</span>
              <span className="flex items-center gap-1 text-[#86868b]">
                <Calendar className="w-3.5 h-3.5" />
                דיווח על {monthLabel} {item.parsed_year}
              </span>
            </div>
          </div>
        </div>

        {/* Numbers row */}
        <div className="mt-5 grid grid-cols-3 gap-3">
          <div className="bg-black/[0.03] rounded-2xl p-3 text-center">
            <div className="text-xs text-[#86868b] mb-1">קריאה קודמת</div>
            <div className="text-xl font-bold text-[#1d1d1f]">
              {item.vehicle?.current_mileage.toLocaleString('he-IL') ?? '—'}
            </div>
          </div>
          <div className="bg-[#ff9500]/[0.08] rounded-2xl p-3 text-center">
            <div className="text-xs text-[#ff9500] mb-1">קריאה שדווחה</div>
            <div className="text-xl font-extrabold text-[#ff9500]">
              {item.parsed_mileage.toLocaleString('he-IL')}
            </div>
          </div>
          <div className="bg-black/[0.03] rounded-2xl p-3 text-center">
            <div className="text-xs text-[#86868b] mb-1">הפרש</div>
            <div className={`text-xl font-bold ${delta && delta < 0 ? 'text-[#ff3b30]' : 'text-[#1d1d1f]'}`}>
              {delta !== null ? (delta > 0 ? '+' : '') + delta.toLocaleString('he-IL') : '—'}
            </div>
          </div>
        </div>

        {/* Context: reason + raw text + time */}
        <div className="mt-4 space-y-1 text-xs text-[#86868b]">
          {item.error && <div>סיבת חסימה: {item.error}</div>}
          {item.raw_text && <div>טקסט מקורי בוואטסאפ: <span className="font-mono">"{item.raw_text}"</span></div>}
          <div>התקבל ב-{formatDateTime(item.received_at)}</div>
        </div>

        {/* Feedback */}
        {feedback && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className={`mt-4 p-3 rounded-xl text-sm font-medium ${
              feedback.type === 'success'
                ? 'bg-[#34c759]/10 text-[#248a3d]'
                : 'bg-[#ff3b30]/10 text-[#ff3b30]'
            }`}
          >
            {feedback.text}
          </motion.div>
        )}

        {/* Actions */}
        {!feedback && (
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              onClick={handleApprove}
              disabled={mutation.isPending}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-[#34c759] text-white hover:bg-[#28a745] disabled:opacity-50 transition-all shadow-sm"
            >
              {mutation.isPending && mutation.variables?.action === 'approve' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              אשר את הקריאה ({item.parsed_mileage.toLocaleString('he-IL')})
            </button>

            {!showRejectInput ? (
              <button
                onClick={() => setShowRejectInput(true)}
                disabled={mutation.isPending}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-[#ff9500]/10 text-[#ff9500] hover:bg-[#ff9500] hover:text-white disabled:opacity-50 transition-all"
              >
                <X className="w-4 h-4" />
                דחה ותקן ידנית
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="ק&quot;מ נכון"
                  value={correctedValue}
                  onChange={(e) => setCorrectedValue(e.target.value)}
                  autoFocus
                  className="w-32 bg-black/5 border-none rounded-xl px-3 py-2.5 text-sm font-mono direction-ltr text-right focus:outline-none focus:ring-2 focus:ring-[#ff9500]/30"
                />
                <button
                  onClick={handleReject}
                  disabled={mutation.isPending}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-[#ff9500] text-white hover:bg-[#e08500] disabled:opacity-50 transition-all shadow-sm"
                >
                  {mutation.isPending && mutation.variables?.action === 'reject' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  שמור
                </button>
                <button
                  onClick={() => { setShowRejectInput(false); setCorrectedValue(''); }}
                  disabled={mutation.isPending}
                  className="px-3 py-2.5 rounded-xl text-sm font-medium text-[#86868b] hover:bg-black/5 transition-all"
                >
                  ביטול
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
