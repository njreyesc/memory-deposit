export type SceneId = "onboarding" | "vault" | "recipients" | "simulate";

export const SCENE_LABELS: Record<SceneId, string> = {
  onboarding: "Онбординг",
  vault: "Депозит",
  recipients: "Близкие",
  simulate: "Симуляция события",
};
