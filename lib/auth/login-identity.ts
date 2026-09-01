/**
 * Login-based identity for the demo.
 *
 * Supabase password auth needs an email, but demo visitors register by a login
 * and never see an address. A login is mapped to a synthetic, internal-only
 * address; the mapping must be deterministic so registration and sign-in agree,
 * which is why both go through this module rather than building the string
 * themselves.
 *
 * The domain is reserved (RFC 6761 `.local`) and unroutable on purpose — no
 * mail is ever sent, and no real inbox can collide with it. Accounts created
 * with a real address (e.g. from the Supabase dashboard) still work: anything
 * already containing "@" is passed through untouched.
 */

export const LOGIN_DOMAIN = "login.local";

/** Latin letters, digits, dot, dash, underscore. 3–32 characters. */
export const LOGIN_PATTERN = /^[a-zA-Z0-9._-]{3,32}$/;

export const LOGIN_RULE_MESSAGE =
  "Логин: 3–32 символа, латиница, цифры, точка, дефис или подчёркивание";

/**
 * Turns what the user typed into the address Supabase will see.
 * Logins are lowercased so "Ivan" and "ivan" are the same account.
 */
export function loginToEmail(input: string): string {
  const value = input.trim();
  if (value.includes("@")) return value.toLowerCase();
  return `${value.toLowerCase()}@${LOGIN_DOMAIN}`;
}

/** True when the address was generated from a login rather than typed by a user. */
export function isSyntheticEmail(email: string): boolean {
  return email.toLowerCase().endsWith(`@${LOGIN_DOMAIN}`);
}
