export const FEATURES = {
  serifHeadings:
    process.env.NEXT_PUBLIC_FEATURE_SERIF_HEADINGS === "1",
  vaultCards:
    process.env.NEXT_PUBLIC_FEATURE_VAULT_CARDS === "1",
  trustCircles:
    process.env.NEXT_PUBLIC_FEATURE_TRUST_CIRCLES === "1",
} as const;
