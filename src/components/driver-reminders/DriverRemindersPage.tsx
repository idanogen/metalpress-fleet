import { useState, useMemo, useCallback, useEffect } from 'react';
import { Search, Send, CheckCircle, Loader2, AlertCircle, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Vehicle } from '@/types/fleet';
import { hasReported } from '@/lib/analytics';
import { VehicleImage } from '@/components/ui/VehicleImage';

const WEBHOOK_URL = 'https://hook.us1.make.com/piugtkez49mveettgmenuepb2v16w7pl';
const COOLDOWN_MS = 48 * 60 * 60 * 1000; // 48 hours
const STORAGE_KEY = 'fleet-reminder-timestamps';

/** Convert Israeli phone like "0523694547" → "972523694547@c.us" for Green API */
function formatWhatsAppId(phone: string): string {
  if (!phone) return '';
  const clean = phone.replace(/[\s\-()]/g, '');
  const intl = clean.startsWith('0') ? '972' + clean.slice(1) : clean;
  return intl + '@c.us';
}

/** Load sent timestamps from localStorage */
function loadTimestamps(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw) as Record<string, number>;
    // Clean up expired entries
    const now = Date.now();
    const clean: Record<string, number> = {};
    for (const [key, ts] of Object.entries(data)) {
      if (now - ts < COOLDOWN_MS) clean[key] = ts;
    }
    return clean;
  } catch {
    return {};
  }
}

/** Save sent timestamps to localStorage */
function saveTimestamps(timestamps: Record<string, number>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(timestamps));
}

/** Get remaining cooldown time as readable Hebrew string */
function getCooldownLabel(sentAt: number): string {
  const remaining = COOLDOWN_MS - (Date.now() - sentAt);
  if (remaining <= 0) return '';
  const hours = Math.floor(remaining / (1000 * 60 * 60));
  const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours} שעות`;
  return `${minutes} דקות`;
}

interface DriverRemindersPageProps {
  vehicles: Vehicle[];
  selectedYear: string;
  selectedMonth: number;
}

type SendStatus = 'idle' | 'sending' | 'sent' | 'error';

const MONTH_NAMES: Record<number, string> = {
  1: 'ינואר', 2: 'פברואר', 3: 'מרץ', 4: 'אפריל',
  5: 'מאי', 6: 'יוני', 7: 'יולי', 8: 'אוגוסט',
  9: 'ספטמבר', 10: 'אוקטובר', 11: 'נובמבר', 12: 'דצמבר',
};

export function DriverRemindersPage({
  vehicles,
  selectedYear,
  selectedMonth,
}: DriverRemindersPageProps) {
  const [search, setSearch] = useState('');
  const [sendStatuses, setSendStatuses] = useState<Record<number, SendStatus>>({});
  const [sendAllStatus, setSendAllStatus] = useState<'idle' | 'sending' | 'done'>('idle');
  const [sentTimestamps, setSentTimestamps] = useState<Record<string, number>>(loadTimestamps);

  // Refresh cooldown display every minute
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(interval);
  }, []);

  /** Check if a vehicle is on cooldown */
  const isOnCooldown = useCallback((vehicleId: number): boolean => {
    const key = `${vehicleId}-${selectedMonth}-${selectedYear}`;
    const ts = sentTimestamps[key];
    if (!ts) return false;
    return Date.now() - ts < COOLDOWN_MS;
  }, [sentTimestamps, selectedMonth, selectedYear]);

  /** Get cooldown remaining label */
  const cooldownRemaining = useCallback((vehicleId: number): string => {
    const key = `${vehicleId}-${selectedMonth}-${selectedYear}`;
    const ts = sentTimestamps[key];
    if (!ts) return '';
    return getCooldownLabel(ts);
  }, [sentTimestamps, selectedMonth, selectedYear]);

  /** Mark vehicle as sent in persistent storage */
  const markSent = useCallback((vehicleId: number) => {
    const key = `${vehicleId}-${selectedMonth}-${selectedYear}`;
    setSentTimestamps(prev => {
      const updated = { ...prev, [key]: Date.now() };
      saveTimestamps(updated);
      return updated;
    });
  }, [selectedMonth, selectedYear]);

  const unreportedVehicles = useMemo(
    () => vehicles.filter(v => !hasReported(v, selectedYear, selectedMonth)),
    [vehicles, selectedYear, selectedMonth]
  );

  const filtered = useMemo(() => {
    if (!search) return unreportedVehicles;
    const s = search.toLowerCase();
    return unreportedVehicles.filter(v =>
      v.driverName.includes(s) ||
      v.model.toLowerCase().includes(s) ||
      v.plateNumber.includes(s) ||
      v.phone.includes(s)
    );
  }, [unreportedVehicles, search]);

  const monthName = MONTH_NAMES[selectedMonth] || `חודש ${selectedMonth}`;

  const buildPayload = useCallback((vehicle: Vehicle) => ({
    action: 'km_reminder',
    timestamp: new Date().toISOString(),
    reportMonth: selectedMonth,
    reportMonthName: MONTH_NAMES[selectedMonth],
    reportYear: selectedYear,
    driver: {
      id: vehicle.id,
      name: vehicle.driverName,
      phone: vehicle.phone,
      whatsappId: formatWhatsAppId(vehicle.phone),
    },
    vehicle: {
      model: vehicle.model,
      plateNumber: vehicle.plateNumber,
      ownershipType: vehicle.ownershipType,
      supplier: vehicle.supplier,
      company: vehicle.company,
      currentMileage: vehicle.currentMileage,
      startDate: vehicle.startDate,
      endDate: vehicle.endDate,
      leaseEndDate: vehicle.leaseEndDate,
      licenseEndDate: vehicle.licenseEndDate,
      rentValue: vehicle.rentValue,
      lastReportYear: vehicle.lastReportYear,
      lastReportMonth: vehicle.lastReportMonth,
    },
  }), [selectedMonth, selectedYear]);

  const sendReminder = useCallback(async (vehicle: Vehicle) => {
    if (isOnCooldown(vehicle.id)) return;
    setSendStatuses(prev => ({ ...prev, [vehicle.id]: 'sending' }));
    try {
      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(vehicle)),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setSendStatuses(prev => ({ ...prev, [vehicle.id]: 'sent' }));
      markSent(vehicle.id);
    } catch (err) {
      console.error(`Failed to send reminder for ${vehicle.driverName}:`, err);
      setSendStatuses(prev => ({ ...prev, [vehicle.id]: 'error' }));
      setTimeout(() => {
        setSendStatuses(prev => ({ ...prev, [vehicle.id]: 'idle' }));
      }, 3000);
    }
  }, [buildPayload, isOnCooldown, markSent]);

  const sendableCount = useMemo(
    () => filtered.filter(v => !isOnCooldown(v.id) && !!v.phone).length,
    [filtered, isOnCooldown]
  );

  const sendAll = useCallback(async () => {
    setSendAllStatus('sending');
    const toSend = filtered.filter(v => !isOnCooldown(v.id) && !!v.phone);
    for (const vehicle of toSend) {
      await sendReminder(vehicle);
      await new Promise(r => setTimeout(r, 300));
    }
    setSendAllStatus('done');
    setTimeout(() => setSendAllStatus('idle'), 3000);
  }, [filtered, isOnCooldown, sendReminder]);

  const sentCount = Object.values(sendStatuses).filter(s => s === 'sent').length;
  const cooldownCount = filtered.filter(v => isOnCooldown(v.id)).length;
  const totalVehicles = vehicles.length;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0, duration: 0.4 }}>
          <div className="glass-card p-4 lg:p-6 cursor-default">
            <div className="w-10 h-10 rounded-2xl bg-[#ff3b30]/10 flex items-center justify-center mb-4">
              <AlertCircle className="w-5 h-5 text-[#ff3b30]" />
            </div>
            <span className="text-3xl font-extrabold text-[#1d1d1f]">{unreportedVehicles.length}</span>
            <p className="text-sm text-[#86868b] mt-1">לא דיווחו</p>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08, duration: 0.4 }}>
          <div className="glass-card p-4 lg:p-6 cursor-default">
            <div className="w-10 h-10 rounded-2xl bg-[#34c759]/10 flex items-center justify-center mb-4">
              <CheckCircle className="w-5 h-5 text-[#248a3d]" />
            </div>
            <span className="text-3xl font-extrabold text-[#1d1d1f]">{totalVehicles - unreportedVehicles.length}</span>
            <p className="text-sm text-[#86868b] mt-1">דיווחו</p>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16, duration: 0.4 }}>
          <div className="glass-card p-4 lg:p-6 cursor-default">
            <div className="w-10 h-10 rounded-2xl bg-[#007AFF]/10 flex items-center justify-center mb-4">
              <Send className="w-5 h-5 text-[#007AFF]" />
            </div>
            <span className="text-3xl font-extrabold text-[#1d1d1f]">{sentCount}</span>
            <p className="text-sm text-[#86868b] mt-1">תזכורות נשלחו</p>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24, duration: 0.4 }}>
          <div className="glass-card p-4 lg:p-6 cursor-default">
            <div className="w-10 h-10 rounded-2xl bg-[#ff9500]/10 flex items-center justify-center mb-4">
              <span className="text-lg font-bold text-[#ff9500]">%</span>
            </div>
            <span className="text-3xl font-extrabold text-[#1d1d1f]">
              {totalVehicles > 0 ? Math.round(((totalVehicles - unreportedVehicles.length) / totalVehicles) * 100) : 0}
            </span>
            <p className="text-sm text-[#86868b] mt-1">אחוז דיווח</p>
          </div>
        </motion.div>
      </div>

      {/* Filters + Send All */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="glass-card p-5"
      >
        <div className="flex flex-wrap items-center gap-3 lg:gap-4">
          {/* Month indicator */}
          <div className="bg-[#007AFF]/10 text-[#007AFF] px-4 py-2 rounded-xl text-sm font-bold">
            {monthName} {selectedYear}
          </div>

          <div className="h-8 w-px bg-black/10 hidden lg:block" />

          {/* Search */}
          <div className="relative flex-1 max-w-[300px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868b]" />
            <input
              type="text"
              placeholder="חיפוש נהג, דגם, לוחית, טלפון..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-black/5 border-none rounded-xl pr-9 pl-3 py-2.5 text-sm text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30"
            />
          </div>

          {/* Cooldown info */}
          {cooldownCount > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-[#ff9500] font-medium">
              <Clock className="w-3.5 h-3.5" />
              {cooldownCount} בהמתנה (48 שעות)
            </div>
          )}

          {/* Send All Button */}
          <button
            onClick={sendAll}
            disabled={sendAllStatus === 'sending' || sendableCount === 0}
            className={`mr-auto flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
              sendAllStatus === 'done'
                ? 'bg-[#34c759] text-white'
                : sendAllStatus === 'sending'
                  ? 'bg-[#25D366]/50 text-white cursor-wait'
                  : sendableCount === 0
                    ? 'bg-black/10 text-[#86868b] cursor-not-allowed'
                    : 'bg-[#25D366] text-white hover:bg-[#20bd5a] shadow-sm hover:shadow-md'
            }`}
          >
            {sendAllStatus === 'sending' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                שולח...
              </>
            ) : sendAllStatus === 'done' ? (
              <>
                <CheckCircle className="w-4 h-4" />
                נשלח!
              </>
            ) : sendableCount === 0 ? (
              <>
                <Clock className="w-4 h-4" />
                כולם בהמתנה
              </>
            ) : (
              <>
                <WhatsAppSmall />
                שלח תזכורת לכולם ({sendableCount})
              </>
            )}
          </button>
        </div>
      </motion.div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="glass-card overflow-hidden"
      >
        <div className="p-6 border-b border-white/30 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#1d1d1f]">נהגים שלא דיווחו ק״מ — {monthName} {selectedYear}</h2>
          <span className="text-sm text-[#86868b]">{filtered.length} נהגים</span>
        </div>

        <div className="overflow-x-auto max-h-[550px] overflow-y-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead className="sticky top-0 bg-white/80 backdrop-blur-sm z-10">
              <tr className="border-b border-white/30">
                <th className="px-4 py-3 text-right text-xs font-bold text-[#86868b]">נהג</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-[#86868b]">טלפון</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-[#86868b]">דגם</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-[#86868b]">לוחית</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-[#86868b]">ספק</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-[#86868b]">ק״מ אחרון</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-[#86868b]">תזכורת</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {filtered.map((vehicle) => {
                  const status = sendStatuses[vehicle.id] || 'idle';
                  const onCooldown = isOnCooldown(vehicle.id);
                  return (
                    <motion.tr
                      key={vehicle.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className={`border-b border-black/[0.03] transition-colors ${
                        onCooldown || status === 'sent' ? 'bg-[#34c759]/[0.04]' : 'hover:bg-white/40'
                      }`}
                    >
                      <td className="px-4 py-3 text-[#1d1d1f] font-medium">{vehicle.driverName}</td>
                      <td className="px-4 py-3 text-[#424245] font-mono text-xs direction-ltr text-right">
                        {vehicle.phone || '—'}
                      </td>
                      <td className="px-4 py-3 text-[#424245]">
                        <div className="flex items-center gap-2.5 max-w-[200px]">
                          <VehicleImage model={vehicle.model} width={48} height={32} />
                          <span className="truncate">{vehicle.model}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[#86868b] font-mono text-xs">{vehicle.plateNumber}</td>
                      <td className="px-4 py-3 text-[#424245] text-xs">{vehicle.supplier || '—'}</td>
                      <td className="px-4 py-3 text-[#86868b] text-xs">
                        {vehicle.currentMileage > 0
                          ? vehicle.currentMileage.toLocaleString()
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <ReminderButton
                          status={status}
                          hasPhone={!!vehicle.phone}
                          onCooldown={onCooldown}
                          cooldownLabel={cooldownRemaining(vehicle.id)}
                          onClick={() => sendReminder(vehicle)}
                        />
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <CheckCircle className="w-10 h-10 text-[#34c759]" />
                      <span className="text-[#86868b] text-lg font-medium">כל הנהגים דיווחו!</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {filtered.length > 0 && (
          <div className="px-6 py-3 border-t border-white/30 text-xs text-[#86868b]">
            מציג {filtered.length} נהגים • {sentCount + cooldownCount} תזכורות נשלחו • {cooldownCount > 0 ? `${cooldownCount} בהמתנת 48 שעות` : ''}
          </div>
        )}
      </motion.div>
    </div>
  );
}

function WhatsAppSmall() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

function ReminderButton({
  status,
  hasPhone,
  onCooldown,
  cooldownLabel,
  onClick,
}: {
  status: SendStatus;
  hasPhone: boolean;
  onCooldown: boolean;
  cooldownLabel: string;
  onClick: () => void;
}) {
  if (onCooldown && status !== 'sending') {
    return (
      <span className="inline-flex items-center gap-1 text-[#ff9500] text-xs font-medium" title={`ניתן לשלוח שוב בעוד ${cooldownLabel}`}>
        <Clock className="w-3.5 h-3.5" />
        עוד {cooldownLabel}
      </span>
    );
  }

  if (status === 'sent') {
    return (
      <span className="inline-flex items-center gap-1 text-[#34c759] text-xs font-bold">
        <CheckCircle className="w-4 h-4" />
        נשלח
      </span>
    );
  }

  if (status === 'sending') {
    return (
      <span className="inline-flex items-center gap-1 text-[#25D366] text-xs font-bold">
        <Loader2 className="w-4 h-4 animate-spin" />
        שולח...
      </span>
    );
  }

  if (status === 'error') {
    return (
      <span className="inline-flex items-center gap-1 text-[#ff3b30] text-xs font-bold">
        <AlertCircle className="w-4 h-4" />
        שגיאה
      </span>
    );
  }

  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      disabled={!hasPhone}
      title={hasPhone ? 'שלח תזכורת בוואטסאפ' : 'אין מספר טלפון'}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
        hasPhone
          ? 'bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366] hover:text-white'
          : 'bg-black/5 text-[#c7c7cc] cursor-not-allowed'
      }`}
    >
      <WhatsAppSmall />
      {hasPhone ? 'שלח' : 'אין טלפון'}
    </button>
  );
}
