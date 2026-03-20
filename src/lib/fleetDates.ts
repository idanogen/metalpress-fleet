import type { Vehicle, UrgencyLevel, DateType, ExpirationItem, ExpirationStats } from '@/types/fleet';

export function getDaysUntil(dateStr: string): number {
  if (!dateStr) return Infinity;
  const target = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function getUrgencyLevel(dateStr: string): UrgencyLevel {
  if (!dateStr) return 'ok';
  const days = getDaysUntil(dateStr);
  if (days < 0) return 'expired';
  if (days <= 30) return 'critical';
  if (days <= 60) return 'warning';
  if (days <= 90) return 'soon';
  return 'ok';
}

export function getUrgencyColor(level: UrgencyLevel) {
  switch (level) {
    case 'expired': return { bg: 'bg-[#ff3b30]/10', text: 'text-[#ff3b30]', dot: 'bg-[#ff3b30]', badge: 'bg-[#ff3b30]/10 text-[#ff3b30]' };
    case 'critical': return { bg: 'bg-[#ff3b30]/10', text: 'text-[#ff3b30]', dot: 'bg-[#ff3b30]', badge: 'bg-[#ff3b30]/10 text-[#ff3b30]' };
    case 'warning': return { bg: 'bg-[#ff9500]/10', text: 'text-[#ff9500]', dot: 'bg-[#ff9500]', badge: 'bg-[#ff9500]/10 text-[#ff9500]' };
    case 'soon': return { bg: 'bg-[#ffcc00]/10', text: 'text-[#b38600]', dot: 'bg-[#ffcc00]', badge: 'bg-[#ffcc00]/10 text-[#b38600]' };
    case 'ok': return { bg: 'bg-[#34c759]/10', text: 'text-[#34c759]', dot: 'bg-[#34c759]', badge: 'bg-[#34c759]/10 text-[#248a3d]' };
  }
}

export function formatDateHebrew(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function getExpirationStats(vehicles: Vehicle[]): ExpirationStats {
  const stats: ExpirationStats = {
    leaseExpired: 0, lease30: 0, lease60: 0, lease90: 0,
    licenseExpired: 0, license30: 0, license60: 0, license90: 0,
    totalUrgent: 0,
  };

  for (const v of vehicles) {
    if (v.leaseEndDate) {
      const days = getDaysUntil(v.leaseEndDate);
      if (days < 0) stats.leaseExpired++;
      else if (days <= 30) stats.lease30++;
      else if (days <= 60) stats.lease60++;
      else if (days <= 90) stats.lease90++;
    }
    if (v.licenseEndDate) {
      const days = getDaysUntil(v.licenseEndDate);
      if (days < 0) stats.licenseExpired++;
      else if (days <= 30) stats.license30++;
      else if (days <= 60) stats.license60++;
      else if (days <= 90) stats.license90++;
    }
  }

  stats.totalUrgent = stats.leaseExpired + stats.lease30 + stats.licenseExpired + stats.license30;
  return stats;
}

export function getExpirationItems(vehicles: Vehicle[]): ExpirationItem[] {
  const items: ExpirationItem[] = [];

  for (const v of vehicles) {
    if (v.leaseEndDate) {
      items.push({
        vehicle: v,
        dateType: 'lease',
        dateStr: v.leaseEndDate,
        daysUntil: getDaysUntil(v.leaseEndDate),
        urgencyLevel: getUrgencyLevel(v.leaseEndDate),
      });
    }
    if (v.licenseEndDate) {
      items.push({
        vehicle: v,
        dateType: 'license',
        dateStr: v.licenseEndDate,
        daysUntil: getDaysUntil(v.licenseEndDate),
        urgencyLevel: getUrgencyLevel(v.licenseEndDate),
      });
    }
  }

  items.sort((a, b) => a.daysUntil - b.daysUntil);
  return items;
}

export function getUniqueSuppliers(vehicles: Vehicle[]): string[] {
  const suppliers = new Set<string>();
  for (const v of vehicles) {
    if (v.supplier) suppliers.add(v.supplier);
  }
  return Array.from(suppliers).sort((a, b) => a.localeCompare(b, 'he'));
}

export function getDaysLabel(days: number): string {
  if (days < 0) return `פג לפני ${Math.abs(days)} ימים`;
  if (days === 0) return 'היום!';
  return `${days} ימים`;
}

export const DATE_TYPE_LABELS: Record<DateType, string> = {
  lease: 'ליסינג',
  license: 'רישוי',
};

export const URGENCY_LABELS: Record<UrgencyLevel, string> = {
  expired: 'פג תוקף',
  critical: '30 יום',
  warning: '60 יום',
  soon: '90 יום',
  ok: 'תקין',
};
