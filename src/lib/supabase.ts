import { createClient } from '@supabase/supabase-js';
import { authOptions } from './mp-sso.js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
}

// MP-6 כניסה אחת (22/10/2026): הכניסה למסך נאכפת בשומר הכניסה (middleware.js) לפי הכרטיס "צי רכב" במרכז,
// והלקוח כאן נושא את הסשן מעוגיית הדומיין כדי ש-RLS יוכל לדרוש משתמש מחובר עם הרשאה לכרטיס.
// המקור של mp-sso.js: ~/Idan-HQ/company/metalpress-sso
export const supabase = createClient(url, anonKey, {
  db: { schema: 'fleet' },
  auth: authOptions,
});
