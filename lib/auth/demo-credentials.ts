/**
 * Password for the test-contour accounts (demo seed users and the throwaway
 * users that /api/test-session/create mints).
 *
 * Server-only and deliberately NOT a constant in the source: this repository
 * is public, so any committed value is a published credential. It previously
 * was — "demo123456" shipped in git and let anyone sign in as the demo
 * breadwinner. All 346 affected accounts have had their passwords rotated.
 *
 * No fallback on purpose. If the variable is missing the test contour must
 * fail loudly rather than quietly recreate accounts with a guessable password.
 */
export function getDemoPassword(): string {
  const password = process.env.DEMO_AUTH_PASSWORD;
  if (!password) {
    throw new Error(
      "DEMO_AUTH_PASSWORD is not set — the test contour cannot sign in. " +
        "Set it in the environment (never commit it)."
    );
  }
  return password;
}
