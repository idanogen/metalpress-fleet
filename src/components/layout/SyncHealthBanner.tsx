import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, RefreshCw, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchSyncHealth, formatDaysAgo } from '@/lib/syncHealth';

/**
 * מציג מתי הנתונים מפריוריטי סונכרנו לאחרונה.
 *
 * למה זה קיים: הסנכרון השבועי נכבה בשקט ב-20/7/2026 והדשבורד הציג נתונים
 * בני 17 יום כאילו הם טריים. שום דבר במסך לא רמז על כך, וההתראה היחידה
 * (מייל הסיכום) היא בדיוק מה שנשבר. הסימן הזה הוא הגיבוי שלא תלוי באף
 * שירות חיצוני: הוא נגזר מהנתונים עצמם, בדפדפן, בכל טעינה.
 *
 * במצב תקין הוא פס דק ושקט. במצב חריג הוא בולט ולא ניתן להתעלמות.
 */
export function SyncHealthBanner() {
  const { data } = useQuery({
    queryKey: ['sync-health'],
    queryFn: fetchSyncHealth,
    refetchOnWindowFocus: true,
    staleTime: 60_000,
  });

  if (!data || data.level === 'unknown') return null;

  const { level, daysSince, lastSyncedAt } = data;
  const dateLabel = lastSyncedAt?.toLocaleDateString('he-IL', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });

  if (level === 'ok') {
    return (
      <div className="flex items-center justify-start gap-2 text-xs text-[#86868b] px-1">
        <CheckCircle2 className="w-3.5 h-3.5 text-[#34c759] shrink-0" />
        <span>הנתונים מפריוריטי סונכרנו {formatDaysAgo(daysSince ?? 0)}</span>
        <span className="text-[#c7c7cc]">·</span>
        <bdi className="tabular-nums">{dateLabel}</bdi>
      </div>
    );
  }

  const isCritical = level === 'critical';
  const accent = isCritical ? '#ff3b30' : '#ff9500';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-4 lg:p-5 border-s-4"
        style={{ borderInlineStartColor: accent, background: `${accent}0d` }}
        role="alert"
      >
        <div className="flex items-start gap-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
            style={{ background: `${accent}1a` }}
          >
            {isCritical
              ? <AlertTriangle className="w-5 h-5" style={{ color: accent }} />
              : <RefreshCw className="w-5 h-5" style={{ color: accent }} />}
          </div>

          <div className="min-w-0">
            <p className="font-bold text-sm lg:text-base" style={{ color: accent }}>
              {isCritical
                ? 'הנתונים בדשבורד אינם מעודכנים'
                : 'הסנכרון מפריוריטי מתעכב'}
            </p>
            <p className="text-xs lg:text-sm text-[#1d1d1f]/75 mt-1 leading-relaxed">
              הסנכרון האחרון מפריוריטי היה{' '}
              <strong className="font-semibold">{formatDaysAgo(daysSince ?? 0)}</strong>
              {dateLabel && <> (<bdi className="tabular-nums">{dateLabel}</bdi>)</>}.
              {' '}הסנכרון אמור לרוץ כל יום שני.
            </p>
            <p className="text-xs text-[#86868b] mt-1.5">
              {isCritical
                ? 'ההוצאות והק"מ המוצגים חסרים ככל הנראה נתונים. יש לבדוק את הסנכרון במייק לפני שמסתמכים על המספרים.'
                : 'ייתכן שריצה אחת לא הושלמה. אם המצב נמשך, יש לבדוק את הסנכרון במייק.'}
            </p>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
