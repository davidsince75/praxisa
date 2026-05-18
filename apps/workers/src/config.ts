import { z } from "zod";

const configSchema = z.object({
  nodeEnv: z
    .enum(["development", "staging", "production"])
    .default("development"),
  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
  databaseUrl: z.string().url(),
  redisUrl: z.string().url(),
  brevo: z.object({
    apiKey: z.string().min(1),
    senderEmail: z.string().email(),
    senderName: z.string().min(1),
  }),
  // Admin email for SLA escalation alerts
  adminEmail: z.string().email().default("admin@praxisa.fr"),
});

export type WorkerConfig = z.infer<typeof configSchema>;

export function loadConfig(): WorkerConfig {
  const result = configSchema.safeParse({
    nodeEnv: process.env["NODE_ENV"],
    logLevel: process.env["LOG_LEVEL"],
    databaseUrl: process.env["DATABASE_URL"],
    redisUrl: process.env["REDIS_URL"],
    brevo: {
      apiKey: process.env["BREVO_API_KEY"],
      senderEmail: process.env["BREVO_SENDER_EMAIL"],
      senderName: process.env["BREVO_SENDER_NAME"],
    },
    adminEmail: process.env["ADMIN_ALERT_EMAIL"],
  });

  if (!result.success) {
    console.error("Invalid worker configuration:", result.error.flatten());
    process.exit(1);
  }

  return result.data;
}
