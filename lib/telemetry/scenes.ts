export type SceneId =
  | "onboarding"
  | "vault"
  | "recipients"
  | "finance"
  | "simulate";

export const SCENE_LABELS: Record<SceneId, string> = {
  onboarding: "Онбординг",
  vault: "Депозит",
  recipients: "Близкие",
  finance: "Финансовая карта",
  simulate: "Симуляция события",
};
