import { useState, useMemo, useCallback, useEffect } from 'react';
import { Search, CheckCircle, Loader2, AlertCircle, Send, Phone } from 'lucide-react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import type { Vehicle } from '@/types/fleet';
import { VehicleImage } from '@/components/ui/VehicleImage';

const WEBHOOK_URL = 'https://hook.us1.make.com/ihow3k8d4okdrk0bugtwezuudk49wdbu';
const STORAGE_KEY = 'fleet-first-message-sent';

const MONTH_NAMES: Record<number, string> = {
  1: 'ינואר', 2: 'פברואר', 3: 'מרץ', 4: 'אפריל',
  5: 'מאי', 6: 'יוני', 7: 'יולי', 8: 'אוגוסט',
  9: 'ספטמבר', 10: 'אוקטובר', 11: 'נובמבר', 12: 'דצמבר',
};

function formatWhatsAppId(phone: string): string {
  if (!phone) return '';
  const clean = phone.replace(/[\s\-()]/g, '');
  const intl = clean.startsWith('0') ? '972' + clean.slice(1) : clean;
  return intl + '@c.us';
}

/** Load sent vehicle IDs for the current month from localStorage */
function loadSentIds(month: number, year: string): Set<number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const data = JSON.parse(raw) as Record<string, number[]>;
    const key = `${month}-${year}`;
    return new Set(data[key] || []);
  } catch {
    return new Set();
  }
}

function saveSentIds(month: number, year: string, ids: Set<number>) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data: Record<string, number[]> = raw ? JSON.parse(raw) : {};
    data[`${month}-${year}`] = [...ids];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString('he-IL', {
    day: 'numeric', month: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

type SendStatus = 'idle' | 'sending' | 'sent' | 'error';

interface SendFirstMessagePageProps {
  vehicles: Vehicle[];
  selectedYear: string;
  selectedMonth: number;
}

export function SendFirstMessagePage({ vehicles, selectedYear, selectedMonth }: SendFirstMessagePageProps) {
  const [search, setSearch] = useState('');
  const [sendStatuses, setSendStatuses] = useState<Record<number, SendStatus>>({});
  const [sentIds, setSentIds] = useState<Set<number>>(() => loadSentIds(selectedMonth, selectedYear));
  const [sentTimestamps, setSentTimestamps] = useState<Record<number, number>>({});

  // Reset when month/year changes
  useEffect(() => {
    setSentIds(loadSentIds(selectedMonth, selectedYear));
    setSendStatuses({});
  }, [selectedMonth, selectedYear]);

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

  const sendMessage = useCallback(async (vehicle: Vehicle) => {
    if (sentIds.has(vehicle.id)) return;
    setSendStatuses(prev => ({ ...prev, [vehicle.id]: 'sending' }));
    try {
      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(vehicle)),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setSendStatuses(prev => ({ ...prev, [vehicle.id]: 'sent' }));
      setSentTimestamps(prev => ({ ...prev, [vehicle.id]: Date.now() }));
      setSentIds(prev => {
        const updated = new Set(prev);
        updated.add(vehicle.id);
        saveSentIds(selectedMonth, selectedYear, updated);
        return updated;
      });
    } catch (err) {
      console.error(`Failed to send first message for ${vehicle.driverName}:`, err);
      setSendStatuses(prev => ({ ...prev, [vehicle.id]: 'error' }));
      setTimeout(() => {
        setSendStatuses(prev => ({ ...prev, [vehicle.id]: 'idle' }));
      }, 3000);
    }
  }, [buildPayload, sentIds, selectedMonth, selectedYear]);

  // Sort: unsent first, sent at the bottom
  const sorted = useMemo(() => {
    const list = [...vehicles];
    list.sort((a, b) => {
      const aSent = sentIds.has(a.id) ? 1 : 0;
      const bSent = sentIds.has(b.id) ? 1 : 0;
      if (aSent !== bSent) return aSent - bSent;
      return a.driverName.localeCompare(b.driverName, 'he');
    });
    return list;
  }, [vehicles, sentIds]);

  const filtered = useMemo(() => {
    if (!search) return sorted;
    const s = search.toLowerCase();
    return sorted.filter(v =>
      v.driverName.includes(s) ||
      v.model.toLowerCase().includes(s) ||
      v.plateNumber.includes(s) ||
      v.phone.includes(s)
    );
  }, [sorted, search]);

  const sentCount = sentIds.size;
  const totalWithPhone = vehicles.filter(v => !!v.phone).length;
  const remainingCount = totalWithPhone - sentCount;


  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0, duration: 0.4 }}>
          <div className="glass-card p-4 lg:p-6 cursor-default">
            <div className="w-10 h-10 rounded-2xl bg-[#007AFF]/10 flex items-center justify-center mb-4">
              <Phone className="w-5 h-5 text-[#007AFF]" />
            </div>
            <span className="text-3xl font-extrabold text-[#1d1d1f]">{vehicles.length}</span>
            <p className="text-sm text-[#86868b] mt-1">סה"כ נהגים</p>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08, duration: 0.4 }}>
          <div className="glass-card p-4 lg:p-6 cursor-default">
            <div className="w-10 h-10 rounded-2xl bg-[#34c759]/10 flex items-center justify-center mb-4">
              <CheckCircle className="w-5 h-5 text-[#248a3d]" />
            </div>
            <span className="text-3xl font-extrabold text-[#1d1d1f]">{sentCount}</span>
            <p className="text-sm text-[#86868b] mt-1">נשלחו</p>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16, duration: 0.4 }}>
          <div className="glass-card p-4 lg:p-6 cursor-default">
            <div className="w-10 h-10 rounded-2xl bg-[#ff9500]/10 flex items-center justify-center mb-4">
              <Send className="w-5 h-5 text-[#ff9500]" />
            </div>
            <span className="text-3xl font-extrabold text-[#1d1d1f]">{remainingCount}</span>
            <p className="text-sm text-[#86868b] mt-1">ממתינים לשליחה</p>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24, duration: 0.4 }}>
          <div className="glass-card p-4 lg:p-6 cursor-default">
            <div className="w-10 h-10 rounded-2xl bg-[#ff9500]/10 flex items-center justify-center mb-4">
              <span className="text-lg font-bold text-[#ff9500]">%</span>
            </div>
            <span className="text-3xl font-extrabold text-[#1d1d1f]">
              {totalWithPhone > 0 ? Math.round((sentCount / totalWithPhone) * 100) : 0}
            </span>
            <p className="text-sm text-[#86868b] mt-1">אחוז שליחה</p>
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
          <div className="bg-[#25D366]/10 text-[#25D366] px-4 py-2 rounded-xl text-sm font-bold">
            {monthName} {selectedYear}
          </div>

          <div className="h-8 w-px bg-black/10 hidden lg:block" />

          <div className="relative flex-1 max-w-[300px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868b]" />
            <input
              type="text"
              placeholder="חיפוש נהג, דגם, לוחית, טלפון..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-black/5 border-none rounded-xl pr-9 pl-3 py-2.5 text-sm text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#25D366]/30"
            />
          </div>

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
          <h2 className="text-lg font-bold text-[#1d1d1f]">שליחת הודעה ראשונה — {monthName} {selectedYear}</h2>
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
                <th className="px-4 py-3 text-right text-xs font-bold text-[#86868b]">חברה</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-[#86868b]">שליחה</th>
              </tr>
            </thead>
            <tbody>
              <LayoutGroup>
                <AnimatePresence>
                  {filtered.map((vehicle) => {
                    const status = sendStatuses[vehicle.id] || 'idle';
                    const isSent = sentIds.has(vehicle.id);
                    const ts = sentTimestamps[vehicle.id];

                    return (
                      <motion.tr
                        key={vehicle.id}
                        layout
                        initial={{ opacity: 0 }}
                        animate={{
                          opacity: isSent ? 0.45 : 1,
                          backgroundColor: isSent ? 'rgba(0,0,0,0.02)' : 'rgba(0,0,0,0)',
                        }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.5 }}
                        className="border-b border-black/[0.03]"
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
                        <td className="px-4 py-3 text-[#424245] text-xs">{vehicle.company || '—'}</td>
                        <td className="px-4 py-3 text-center">
                          {isSent ? (
                            <span
                              className="inline-flex items-center gap-1 text-[#34c759] text-xs font-bold"
                              title={ts ? `נשלח ב-${formatDateTime(ts)}` : 'נשלח'}
                            >
                              <CheckCircle className="w-4 h-4" />
                              נשלח
                            </span>
                          ) : status === 'sending' ? (
                            <span className="inline-flex items-center gap-1 text-[#25D366] text-xs font-bold">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              שולח...
                            </span>
                          ) : status === 'error' ? (
                            <span className="inline-flex items-center gap-1 text-[#ff3b30] text-xs font-bold">
                              <AlertCircle className="w-4 h-4" />
                              שגיאה
                            </span>
                          ) : (
                            <button
                              onClick={(e) => { e.stopPropagation(); sendMessage(vehicle); }}
                              disabled={!vehicle.phone}
                              title={vehicle.phone ? 'שלח הודעה ראשונה בוואטסאפ' : 'אין מספר טלפון'}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                vehicle.phone
                                  ? 'bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366] hover:text-white'
                                  : 'bg-black/5 text-[#c7c7cc] cursor-not-allowed'
                              }`}
                            >
                              <WhatsAppSmall />
                              {vehicle.phone ? 'שלח' : 'אין טלפון'}
                            </button>
                          )}
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </LayoutGroup>
            </tbody>
          </table>
        </div>

        {filtered.length > 0 && (
          <div className="px-6 py-3 border-t border-white/30 text-xs text-[#86868b]">
            {sentCount} נשלחו מתוך {totalWithPhone} • {remainingCount} ממתינים
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
