export const MONTH_LABELS = ['ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יונ', 'יול', 'אוג', 'ספט', 'אוק', 'נוב', 'דצמ'];

export const COMPANY_SHORT_NAMES: Record<string, string> = {
  'מטלפרס פתרונות חכמים בע"מ': 'פתרונות',
  'מטלפרס דלתות ומחיצות אש בע"מ': 'דלתות',
  'מטלפרס שירות בע"מ': 'שירות',
  'מטלפרס ניהול עשן בע"מ': 'ניהול עשן',
  "מטלפרס ייצוא (1982) בע'מ": 'ייצוא',
  'מטלפרס מיגון אש בע"מ': 'מיגון אש',
  'פ.א כוכב 2018 בע"מ': 'כוכב',
};

export function shortenCompanyName(name: string): string {
  return COMPANY_SHORT_NAMES[name] || name;
}

export function formatCurrency(value: number): string {
  return `₪${Math.round(value).toLocaleString()}`;
}
