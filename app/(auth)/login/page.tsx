import { isTestMode } from "@/lib/test-mode";
import { LoginHero } from "./login-hero";

// Read TEST_MODE per request rather than at build time, so the tester form
// follows the deployment's env instead of whatever was set when it was built.
export const dynamic = "force-dynamic";

export default function LoginPage() {
  return <LoginHero testMode={isTestMode()} />;
}
