import { LoginForm } from "./login-form";

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
        <LoginForm />
      </div>
    </div>
  );
}
