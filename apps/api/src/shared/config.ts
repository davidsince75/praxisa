import { z } from "zod";

const configSchema = z.object({
  nodeEnv: z
    .enum(["development", "staging", "production"])
    .default("development"),
  port: z.coerce.number().default(3000),
  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
  corsOrigins: z.string().transform((s) => s.split(",")),
  databaseUrl: z.string().url(),
  redisUrl: z.string().url(),
  jwt: z.object({
    privateKey: z.string().min(1),
    publicKey: z.string().min(1),
  }),
  comms: z.object({
    brevoApiKey: z.string().min(1),
    senderEmail: z.string().email(),
    senderName: z.string().min(1),
  }),
  appBaseUrl: z.string().url().default("http://localhost:5173"),
  mistralApiKey: z.string().min(1).optional(),
  // Optional: enables real YouTube search for AI resource suggestions.
  // Without it, video suggestions degrade to YouTube search links.
  youtubeApiKey: z.string().min(1).optional(),
  google: z
    .object({
      clientId: z.string().min(1),
      clientSecret: z.string().min(1),
      redirectUri: z.string().url(),
    })
    .optional(),
  gocardless: z
    .object({
      accessToken: z.string().min(1),
      environment: z.enum(["sandbox", "live"]).default("sandbox"),
    })
    .optional(),
});

export type AppConfig = z.infer<typeof configSchema>;

export function loadConfig(): AppConfig {
  const result = configSchema.safeParse({
    nodeEnv: process.env["NODE_ENV"],
    port: process.env["PORT"],
    logLevel: process.env["LOG_LEVEL"],
    corsOrigins: process.env["CORS_ORIGINS"] ?? "http://localhost:5173",
    databaseUrl: process.env["DATABASE_URL"],
    redisUrl: process.env["REDIS_URL"],
    jwt: {
      privateKey: process.env["JWT_SIGNING_KEY"]
        ? Buffer.from(process.env["JWT_SIGNING_KEY"], "base64").toString(
            "utf-8",
          )
        : "",
      publicKey: process.env["JWT_SIGNING_KEY_PUBLIC"]
        ? Buffer.from(process.env["JWT_SIGNING_KEY_PUBLIC"], "base64").toString(
            "utf-8",
          )
        : "",
    },
    comms: {
      brevoApiKey: process.env["BREVO_API_KEY"],
      senderEmail: process.env["BREVO_SENDER_EMAIL"],
      senderName: process.env["BREVO_SENDER_NAME"],
    },
    appBaseUrl: process.env["APP_BASE_URL"],
    mistralApiKey: process.env["MISTRAL_API_KEY"],
    youtubeApiKey: process.env["YOUTUBE_API_KEY"],
    google:
      process.env["GOOGLE_CLIENT_ID"] && process.env["GOOGLE_CLIENT_SECRET"]
        ? {
            clientId: process.env["GOOGLE_CLIENT_ID"],
            clientSecret: process.env["GOOGLE_CLIENT_SECRET"],
            redirectUri:
              process.env["GOOGLE_REDIRECT_URI"] ??
              "http://localhost:3000/v1/gmail/callback",
          }
        : undefined,
    gocardless: process.env["GOCARDLESS_ACCESS_TOKEN"]
      ? {
          accessToken: process.env["GOCARDLESS_ACCESS_TOKEN"],
          environment:
            (process.env["GOCARDLESS_ENVIRONMENT"] as
              | "sandbox"
              | "live"
              | undefined) ?? "sandbox",
        }
      : undefined,
  });

  if (!result.success) {
    console.error("Invalid configuration:", result.error.flatten());
    process.exit(1);
  }

  return result.data;
}
