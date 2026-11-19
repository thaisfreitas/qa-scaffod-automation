export const Tags = {
  smoke: "@smoke",
  critical: "@critical",
  regression: "@regression",
  api: "@api",
  ui: "@ui",
  quarantine: "@quarantine",
} as const;

export type Tag = (typeof Tags)[keyof typeof Tags];

export type RiskTag = "smoke" | "critical" | "regression";

export type LayerTag = "api" | "ui" | "quarantine";

export type Team = "identity" | "catalog" | "checkout" | "platform";

export function meta(owner: Team): {
  annotation: { type: "owner"; description: Team };
} {
  return {
    annotation: {
      type: "owner",
      description: owner,
    },
  };
}
