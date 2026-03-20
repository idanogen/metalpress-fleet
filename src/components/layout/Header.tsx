import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { MONTH_NAMES } from '@/lib/analytics';

interface HeaderProps {
  selectedYear: string;
  selectedMonth: number;
  onYearChange: (year: string) => void;
  onMonthChange: (month: number) => void;
  lastUpdated?: Date | null;
  isLoading?: boolean;
}

interface GlassDropdownProps {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  width?: number;
}

function GlassDropdown({ value, options, onChange, width = 120 }: GlassDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const selectedLabel = options.find(o => o.value === value)?.label || value;

  return (
    <div ref={ref} className="relative" style={{ width }}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`
          w-full flex items-center justify-between gap-2
          px-4 py-2 rounded-xl text-sm font-medium
          transition-all duration-200 cursor-pointer
          ${open
            ? 'bg-[#007AFF]/10 text-[#007AFF] ring-2 ring-[#007AFF]/20'
            : 'bg-black/5 text-[#1d1d1f] hover:bg-black/[0.08]'
          }
        `}
      >
        <span>{selectedLabel}</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 4, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute top-full left-0 right-0 z-50 mt-1 py-1.5 rounded-2xl bg-white/80 backdrop-blur-[30px] border border-white/60 shadow-[0_12px_40px_rgba(0,0,0,0.12),0_0_0_1px_rgba(0,0,0,0.03)] overflow-hidden"
          >
            <div className="max-h-[240px] overflow-y-auto">
              {options.map(option => {
                const isSelected = option.value === value;
                return (
                  <button
                    key={option.value}
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    className={`
                      w-full flex items-center justify-between px-3.5 py-2 text-sm transition-colors
                      ${isSelected
                        ? 'text-[#007AFF] font-bold bg-[#007AFF]/[0.06]'
                        : 'text-[#1d1d1f] hover:bg-black/[0.04]'
                      }
                    `}
                  >
                    <span>{option.label}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-[#007AFF]" />}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Header({ selectedYear, selectedMonth, onYearChange, onMonthChange, lastUpdated, isLoading }: HeaderProps) {
  const now = new Date();
  const currentYear = String(now.getFullYear());
  const currentMonth = now.getMonth() + 1;

  const monthOptions = Object.entries(MONTH_NAMES)
    .filter(([num]) => {
      if (selectedYear < currentYear) return true;
      return Number(num) <= currentMonth;
    })
    .map(([num, name]) => ({
      value: num,
      label: name,
    }));

  const yearOptions = ['2026', '2025', '2024'].map(y => ({ value: y, label: y }));

  return (
    <header className="fixed top-3 lg:top-5 right-3 lg:right-[300px] left-3 lg:left-5 h-[60px] lg:h-[70px] bg-white/40 backdrop-blur-[25px] border border-white/60 rounded-2xl lg:rounded-[20px] px-3 lg:px-6 flex items-center justify-between shadow-[0_8px_32px_rgba(0,0,0,0.03)] z-40">
      <div className="flex items-center gap-2 lg:gap-4">
        {/* Spacer for hamburger button on mobile */}
        <div className="w-8 lg:hidden" />
        <h1 className="text-sm lg:text-lg font-extrabold text-[#1d1d1f] tracking-tight">ניהול צי רכבים</h1>
        <div className="h-5 w-px bg-black/10 hidden lg:block" />
        <div className="hidden lg:flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isLoading ? 'bg-[#ff9500] animate-pulse' : 'bg-[#34c759]'}`} />
          <span className="text-xs font-bold text-[#86868b] uppercase tracking-wider">
            {isLoading ? 'מסנכרן...' : 'מסונכרן'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 lg:gap-3">
        <GlassDropdown
          value={String(selectedMonth)}
          options={monthOptions}
          onChange={(v) => onMonthChange(Number(v))}
          width={90}
        />

        <GlassDropdown
          value={selectedYear}
          options={yearOptions}
          onChange={onYearChange}
          width={75}
        />

        <div className="text-xs text-[#86868b] hidden lg:block">
          {lastUpdated
            ? `עדכון: ${lastUpdated.toLocaleDateString('he-IL')}, ${lastUpdated.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`
            : 'עדכון: —'
          }
        </div>
      </div>
    </header>
  );
}
