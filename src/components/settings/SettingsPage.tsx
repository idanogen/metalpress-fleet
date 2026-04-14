import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { SlidersHorizontal, Palette, Check } from 'lucide-react';
import type { Vehicle } from '@/types/fleet';

// ── Persisted settings via localStorage ──

const SETTINGS_KEY = 'fleet-settings';

export interface FleetSettings {
  anomalyThreshold: number; // percentage deviation to flag as anomaly (default 30)
  companyColors: Record<string, string>;
  companyShortNames: Record<string, string>;
}

const DEFAULT_COLORS = ['#007AFF', '#34c759', '#ff9500', '#ff3b30', '#5856D6', '#ff2d55', '#5ac8fa', '#af52de'];

const DEFAULT_SHORT_NAMES: Record<string, string> = {
  'מטלפרס פתרונות חכמים בע"מ': 'פתרונות',
  'מטלפרס דלתות ומחיצות אש בע"מ': 'דלתות',
  'מטלפרס שירות בע"מ': 'שירות',
  'מטלפרס ניהול עשן בע"מ': 'ניהול עשן',
  "מטלפרס ייצוא (1982) בע'מ": 'ייצוא',
  'מטלפרס מיגון אש בע"מ': 'מיגון אש',
  'פ.א כוכב 2018 בע"מ': 'כוכב',
};

export function getDefaultSettings(): FleetSettings {
  return {
    anomalyThreshold: 30,
    companyColors: {},
    companyShortNames: { ...DEFAULT_SHORT_NAMES },
  };
}

export function loadSettings(): FleetSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return getDefaultSettings();
    return { ...getDefaultSettings(), ...JSON.parse(raw) };
  } catch {
    return getDefaultSettings();
  }
}

export function saveSettings(settings: FleetSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

// ── Component ──

interface SettingsPageProps {
  allVehicles: Vehicle[];
}

const COLOR_PALETTE = [
  '#007AFF', '#34c759', '#ff9500', '#ff3b30', '#5856D6',
  '#ff2d55', '#5ac8fa', '#af52de', '#86868b', '#30b0c7',
  '#a2845e', '#63da38', '#e74c3c', '#2ecc71', '#f39c12',
];

function ColorPicker({ color, onChange }: { color: string; onChange: (c: string) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-8 h-8 rounded-xl border-2 border-white shadow-sm cursor-pointer hover:scale-110 transition-transform"
        style={{ backgroundColor: color }}
      />
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-10 right-0 z-50 flex flex-wrap gap-1.5 p-2.5 rounded-2xl bg-white/90 backdrop-blur-xl border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.12)] w-[180px]">
            {COLOR_PALETTE.map(c => (
              <button
                key={c}
                onClick={() => { onChange(c); setOpen(false); }}
                className={`w-7 h-7 rounded-lg border-2 hover:scale-110 transition-transform ${c === color ? 'border-[#1d1d1f] scale-110' : 'border-white/60'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function SettingsPage({ allVehicles }: SettingsPageProps) {
  const [settings, setSettings] = useState<FleetSettings>(loadSettings);
  const [saved, setSaved] = useState(false);

  const companies = useMemo(() => {
    const set = new Set<string>();
    for (const v of allVehicles) {
      if (v.company?.trim()) set.add(v.company.trim());
    }
    return Array.from(set).sort();
  }, [allVehicles]);

  const handleSave = () => {
    saveSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const updateThreshold = (val: number) => {
    setSettings(s => ({ ...s, anomalyThreshold: val }));
  };

  const updateCompanyColor = (fullName: string, color: string) => {
    setSettings(s => ({
      ...s,
      companyColors: { ...s.companyColors, [fullName]: color },
    }));
  };

  return (
    <div className="space-y-6">
      {/* Save Button */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-extrabold text-[#1d1d1f]">הגדרות</h2>
        <button
          onClick={handleSave}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-bold transition-all ${
            saved
              ? 'bg-[#34c759] text-white'
              : 'bg-[#007AFF] text-white hover:bg-[#0066d6]'
          }`}
        >
          {saved ? <Check className="w-4 h-4" /> : null}
          {saved ? 'נשמר!' : 'שמור הגדרות'}
        </button>
      </div>

      {/* Section 1: Anomaly Threshold */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-card p-6"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-[#ff9500]/10 flex items-center justify-center">
            <SlidersHorizontal className="w-5 h-5 text-[#ff9500]" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-[#1d1d1f]">סף חריגות</h3>
            <p className="text-sm text-[#86868b]">אחוז סטייה מהממוצע שמסומן כחריגה</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <input
            type="range"
            min={10}
            max={80}
            step={5}
            value={settings.anomalyThreshold}
            onChange={e => updateThreshold(Number(e.target.value))}
            className="flex-1 h-2 rounded-full appearance-none bg-black/10 accent-[#ff9500]"
          />
          <div className="flex items-center gap-1 min-w-[80px]">
            <input
              type="number"
              min={10}
              max={80}
              value={settings.anomalyThreshold}
              onChange={e => updateThreshold(Number(e.target.value))}
              className="w-16 bg-black/5 border-none rounded-xl px-3 py-2 text-sm font-bold text-center text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#ff9500]/30"
            />
            <span className="text-sm text-[#86868b]">%</span>
          </div>
        </div>
        <p className="text-xs text-[#86868b] mt-2">
          נהג שהק"מ שלו חורג ב-{settings.anomalyThreshold}% מהממוצע שלו יסומן כחריגה
        </p>
      </motion.div>

      {/* Section 2: Company Names & Colors */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass-card p-6"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-[#5856D6]/10 flex items-center justify-center">
            <Palette className="w-5 h-5 text-[#5856D6]" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-[#1d1d1f]">ניהול חברות</h3>
            <p className="text-sm text-[#86868b]">שם מקוצר וצבע לכל חברה</p>
          </div>
        </div>

        <div className="space-y-3">
          {companies.map((company, i) => (
            <div key={company} className="flex items-center gap-3 p-3 rounded-2xl bg-black/[0.02] hover:bg-black/[0.04] transition-colors">
              {/* Color picker */}
              <ColorPicker
                color={settings.companyColors[company] || DEFAULT_COLORS[i % DEFAULT_COLORS.length]}
                onChange={color => updateCompanyColor(company, color)}
              />

              {/* Full name */}
              <span className="text-xs text-[#86868b] flex-1 truncate">{company}</span>

              {/* Short name display */}
              <span className="w-28 text-sm font-bold text-[#1d1d1f] text-center px-3 py-2 bg-black/5 rounded-xl">
                {settings.companyShortNames[company] || company}
              </span>
            </div>
          ))}
        </div>
      </motion.div>

    </div>
  );
}
