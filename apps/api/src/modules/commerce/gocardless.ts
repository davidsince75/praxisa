import { GoCardlessClient, Environments } from "gocardless-nodejs";

export interface GoCardlessConfig {
  accessToken: string;
  environment: "sandbox" | "live";
  webhookSecret?: string | undefined;
}

/** Build a GoCardless client, or null when the integration is not configured. */
export function makeGoCardlessClient(
  gcConfig: GoCardlessConfig | undefined,
): GoCardlessClient | null {
  if (!gcConfig) return null;
  return new GoCardlessClient(
    gcConfig.accessToken,
    gcConfig.environment === "live" ? Environments.Live : Environments.Sandbox,
  );
}
