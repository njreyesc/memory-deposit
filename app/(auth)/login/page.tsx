import { LoginForm } from "./login-form";
import TestLoginForm from "./test-login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8 text-center">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">
            Депозит памяти
          </h1>
          <p className="text-muted-foreground">
            Цифровой сейф для вашей семьи
          </p>
        </div>
        <div className="space-y-6">
          <TestLoginForm />
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">или</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
