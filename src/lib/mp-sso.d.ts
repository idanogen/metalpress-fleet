// טיפוסים ל-mp-sso.js (המקור: ~/Idan-HQ/company/metalpress-sso/mp-sso.mjs)
import type { SupabaseClient } from "@supabase/supabase-js";
export const SSO_DOMAIN: string;
export const HUB_URL: string;
export const STORAGE_KEY: string;
export function onSsoDomain(): boolean;
export function readSession(): string | null;
export function clearSession(): void;
export const storage: { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void };
export const authOptions: { storage: typeof storage; storageKey: string; persistSession: boolean; autoRefreshToken: boolean; detectSessionInUrl: boolean };
export function safeNext(raw: string | null): string | null;
export function goToHub(why?: string): void;
export function signOutEverywhere(sb: SupabaseClient): Promise<void>;
