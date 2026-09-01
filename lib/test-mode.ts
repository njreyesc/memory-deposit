/**
 * Test-contour switch.
 *
 * Guards /api/mock-login and /api/test-session/*, which mint real Supabase
 * sessions without asking for any credentials. Off by default: an unset
 * TEST_MODE means those routes answer 404.
 *
 * Server-only on purpose. TEST_MODE carries no NEXT_PUBLIC_ prefix, so Next
 * never inlines it into the browser bundle — in client code the value would
 * silently read as undefined. Client components must receive it as a prop
 * from a server component instead of importing this module.
 */
export function isTestMode(): boolean {
  return process.env.TEST_MODE === "true";
}
