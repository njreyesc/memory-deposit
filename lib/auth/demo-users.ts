export type DemoRole = "alexey" | "maria";

export interface DemoUser {
  id: string;
  full_name: string;
  role: "breadwinner" | "recipient";
  email: string;
  avatar_initial: string;
}

export const DEMO_USERS: Record<DemoRole, DemoUser> = {
  alexey: {
    id: "11111111-1111-1111-1111-111111111111",
    full_name: "Alexey Ivanov",
    role: "breadwinner",
    email: "alexey@demo.local",
    avatar_initial: "A",
  },
  maria: {
    id: "22222222-2222-2222-2222-222222222222",
    full_name: "Maria Ivanova",
    role: "recipient",
    email: "maria@demo.local",
    avatar_initial: "M",
  },
} as const;

export const DEMO_PASSWORD = "demo123456";
