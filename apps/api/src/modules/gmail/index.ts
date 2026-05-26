import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { google } from "googleapis";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { gmailConnections } from "../../db/schema/index.js";
import { chatComplete, MISTRAL_SMALL } from "../ai/mistral-client.js";

// ── Helpers ─────────────────────────────────────────────────────────────────────

interface PayloadPart {
  mimeType?: string;
  body?: { data?: string };
  parts?: PayloadPart[];
}

function makeOAuth2(
  clientId: string,
  clientSecret: string,
  redirectUri: string,
) {
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

function decodeBody(payload: PayloadPart): string {
  if (payload.body?.data) {
    return Buffer.from(payload.body.data, "base64url").toString("utf-8");
  }
  if (payload.parts) {
    const htmlPart = payload.parts.find((p) => p.mimeType === "text/html");
    if (htmlPart?.body?.data) {
      return Buffer.from(htmlPart.body.data, "base64url").toString("utf-8");
    }
    const textPart = payload.parts.find((p) => p.mimeType === "text/plain");
    if (textPart?.body?.data) {
      return Buffer.from(textPart.body.data, "base64url").toString("utf-8");
    }
  }
  return "";
}

interface HeaderEntry {
  name?: string | null;
  value?: string | null;
}

function getHeader(headers: HeaderEntry[] | undefined, name: string): string {
  return (
    headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ??
    ""
  );
}

// ── Plugin ──────────────────────────────────────────────────────────────────────

export function gmailPlugin(fastify: FastifyInstance) {
  const googleConfig = (
    fastify as unknown as {
      config?: {
        google?: {
          clientId: string;
          clientSecret: string;
          redirectUri: string;
        };
      };
    }
  ).config?.google;

  const mistralApiKey = (fastify as unknown as { mistralApiKey?: string })
    .mistralApiKey;

  // ── Helper: get authenticated Gmail client ────────────────────────────────
  async function getGmailClient(userId: string) {
    if (!googleConfig) return null;
    const rows = await fastify.db
      .select()
      .from(gmailConnections)
      .where(eq(gmailConnections.userId, userId));
    if (rows.length === 0 || rows[0] === undefined) return null;
    const conn = rows[0];
    const oauth2 = makeOAuth2(
      googleConfig.clientId,
      googleConfig.clientSecret,
      googleConfig.redirectUri,
    );
    oauth2.setCredentials({
      access_token: conn.accessToken,
      refresh_token: conn.refreshToken,
      expiry_date: conn.tokenExpiresAt.getTime(),
    });

    // Refresh if expired
    if (Date.now() > conn.tokenExpiresAt.getTime() - 60_000) {
      const { credentials } = await oauth2.refreshAccessToken();
      await fastify.db
        .update(gmailConnections)
        .set({
          accessToken: credentials.access_token ?? conn.accessToken,
          tokenExpiresAt: new Date(
            credentials.expiry_date ?? Date.now() + 3600_000,
          ),
        })
        .where(eq(gmailConnections.userId, userId));
      oauth2.setCredentials(credentials);
    }

    return google.gmail({ version: "v1", auth: oauth2 });
  }

  // ── GET /gmail/auth-url ───────────────────────────────────────────────────
  fastify.get(
    "/gmail/auth-url",
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { role } = request.jwtPayload;
      if (role !== "admin") {
        return reply.status(403).send({ error: "Forbidden" });
      }
      if (!googleConfig) {
        return reply
          .status(501)
          .send({ error: "Configuration Google manquante" });
      }
      const oauth2 = makeOAuth2(
        googleConfig.clientId,
        googleConfig.clientSecret,
        googleConfig.redirectUri,
      );
      const url = oauth2.generateAuthUrl({
        access_type: "offline",
        prompt: "consent",
        scope: [
          "https://www.googleapis.com/auth/gmail.readonly",
          "https://www.googleapis.com/auth/gmail.send",
          "https://www.googleapis.com/auth/gmail.modify",
          "https://www.googleapis.com/auth/userinfo.email",
        ],
        state: request.jwtPayload.sub,
      });
      return reply.send({ url });
    },
  );

  // ── GET /gmail/callback ───────────────────────────────────────────────────
  fastify.get(
    "/gmail/callback",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { code, state } = request.query as {
        code?: string;
        state?: string;
      };
      if (!code || !state || !googleConfig) {
        return reply.status(400).send({ error: "Missing params" });
      }
      const oauth2 = makeOAuth2(
        googleConfig.clientId,
        googleConfig.clientSecret,
        googleConfig.redirectUri,
      );
      const { tokens } = await oauth2.getToken(code);
      oauth2.setCredentials(tokens);

      const info = await google
        .oauth2({ version: "v2", auth: oauth2 })
        .userinfo.get();
      const emailAddress = info.data.email ?? "unknown";

      await fastify.db
        .insert(gmailConnections)
        .values({
          userId: state,
          accessToken: tokens.access_token ?? "",
          refreshToken: tokens.refresh_token ?? "",
          tokenExpiresAt: new Date(tokens.expiry_date ?? Date.now() + 3600_000),
          emailAddress,
        })
        .onConflictDoUpdate({
          target: gmailConnections.userId,
          set: {
            accessToken: tokens.access_token ?? "",
            refreshToken: tokens.refresh_token ?? "",
            tokenExpiresAt: new Date(
              tokens.expiry_date ?? Date.now() + 3600_000,
            ),
            emailAddress,
            connectedAt: new Date(),
          },
        });

      const appBaseUrl =
        (
          fastify as unknown as {
            config?: { appBaseUrl?: string };
          }
        ).config?.appBaseUrl ?? "http://localhost:5173";
      return reply.redirect(appBaseUrl + "/email?connected=true");
    },
  );

  // ── GET /gmail/status ─────────────────────────────────────────────────────
  fastify.get(
    "/gmail/status",
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { role, sub } = request.jwtPayload;
      if (role !== "admin") {
        return reply.status(403).send({ error: "Forbidden" });
      }
      const rows = await fastify.db
        .select()
        .from(gmailConnections)
        .where(eq(gmailConnections.userId, sub));
      const row = rows[0];
      if (!row) {
        return reply.send({ connected: false });
      }
      return reply.send({
        connected: true,
        email: row.emailAddress,
        connectedAt: row.connectedAt,
      });
    },
  );

  // ── DELETE /gmail/disconnect ──────────────────────────────────────────────
  fastify.delete(
    "/gmail/disconnect",
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { role, sub } = request.jwtPayload;
      if (role !== "admin") {
        return reply.status(403).send({ error: "Forbidden" });
      }
      await fastify.db
        .delete(gmailConnections)
        .where(eq(gmailConnections.userId, sub));
      return reply.status(204).send();
    },
  );

  // ── GET /gmail/messages ───────────────────────────────────────────────────
  fastify.get(
    "/gmail/messages",
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { role, sub } = request.jwtPayload;
      if (role !== "admin") {
        return reply.status(403).send({ error: "Forbidden" });
      }
      const { q, pageToken } = request.query as {
        q?: string;
        pageToken?: string;
      };
      const gmail = await getGmailClient(sub);
      if (!gmail) {
        return reply.status(400).send({ error: "Gmail non connecté" });
      }
      const listParams: {
        userId: string;
        maxResults: number;
        q: string;
        pageToken?: string;
      } = {
        userId: "me",
        maxResults: 20,
        q: q ?? "in:inbox",
      };
      if (pageToken) {
        listParams.pageToken = pageToken;
      }
      const res = await gmail.users.messages.list(listParams);

      const rawMessages = res.data.messages ?? [];
      const messages = await Promise.all(
        rawMessages.map(async (m: { id?: string | null }) => {
          if (!m.id) return null;
          const msg = await gmail.users.messages.get({
            userId: "me",
            id: m.id,
            format: "metadata",
            metadataHeaders: ["From", "Subject", "Date"],
          });
          const hdrs = msg.data.payload?.headers as HeaderEntry[] | undefined;
          return {
            id: msg.data.id,
            threadId: msg.data.threadId,
            snippet: msg.data.snippet,
            from: getHeader(hdrs, "From"),
            subject: getHeader(hdrs, "Subject"),
            date: getHeader(hdrs, "Date"),
            labelIds: msg.data.labelIds,
            isUnread: msg.data.labelIds?.includes("UNREAD") ?? false,
          };
        }),
      );

      return reply.send({
        messages: messages.filter(Boolean),
        nextPageToken: res.data.nextPageToken ?? null,
      });
    },
  );

  // ── GET /gmail/messages/:id ───────────────────────────────────────────────
  fastify.get(
    "/gmail/messages/:id",
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { role, sub } = request.jwtPayload;
      if (role !== "admin") {
        return reply.status(403).send({ error: "Forbidden" });
      }
      const { id } = request.params as { id: string };
      const gmail = await getGmailClient(sub);
      if (!gmail) {
        return reply.status(400).send({ error: "Gmail non connecté" });
      }
      const msg = await gmail.users.messages.get({
        userId: "me",
        id,
        format: "full",
      });

      // Mark as read
      await gmail.users.messages.modify({
        userId: "me",
        id,
        requestBody: { removeLabelIds: ["UNREAD"] },
      });

      const hdrs = msg.data.payload?.headers as HeaderEntry[] | undefined;
      return reply.send({
        id: msg.data.id,
        threadId: msg.data.threadId,
        from: getHeader(hdrs, "From"),
        to: getHeader(hdrs, "To"),
        subject: getHeader(hdrs, "Subject"),
        date: getHeader(hdrs, "Date"),
        body: decodeBody(msg.data.payload as PayloadPart),
        labelIds: msg.data.labelIds,
      });
    },
  );

  // ── POST /gmail/messages/:id/reply ────────────────────────────────────────
  const replySchema = z.object({ body: z.string().min(1).max(50000) });

  fastify.post(
    "/gmail/messages/:id/reply",
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { role, sub } = request.jwtPayload;
      if (role !== "admin") {
        return reply.status(403).send({ error: "Forbidden" });
      }
      const { id } = request.params as { id: string };
      const parse = replySchema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({ error: parse.error.flatten() });
      }

      const gmail = await getGmailClient(sub);
      if (!gmail) {
        return reply.status(400).send({ error: "Gmail non connecté" });
      }

      const original = await gmail.users.messages.get({
        userId: "me",
        id,
        format: "metadata",
        metadataHeaders: ["From", "Subject", "Message-ID"],
      });
      const origHdrs = original.data.payload?.headers as
        | HeaderEntry[]
        | undefined;
      const origFrom = getHeader(origHdrs, "From");
      const origSubject = getHeader(origHdrs, "Subject");
      const messageId = getHeader(origHdrs, "Message-ID");

      const connRows = await fastify.db
        .select()
        .from(gmailConnections)
        .where(eq(gmailConnections.userId, sub));
      const senderEmail = connRows[0]?.emailAddress ?? "noreply@praxisa.fr";

      const subject = origSubject.startsWith("Re:")
        ? origSubject
        : "Re: " + origSubject;
      const raw = [
        "MIME-Version: 1.0",
        "Content-Type: text/html; charset=utf-8",
        `From: ${senderEmail}`,
        `To: ${origFrom}`,
        `Subject: ${subject}`,
        `In-Reply-To: ${messageId}`,
        `References: ${messageId}`,
        "",
        parse.data.body,
      ].join("\r\n");

      const encoded = Buffer.from(raw).toString("base64url");
      await gmail.users.messages.send({
        userId: "me",
        requestBody: {
          raw: encoded,
          threadId: original.data.threadId ?? null,
        },
      });

      return reply.send({ success: true });
    },
  );

  // ── POST /gmail/ai-draft ──────────────────────────────────────────────────
  const aiDraftSchema = z.object({
    emailSubject: z.string(),
    emailBody: z.string(),
    instruction: z
      .string()
      .default(
        "Rédige une réponse professionnelle et chaleureuse en français.",
      ),
  });

  fastify.post(
    "/gmail/ai-draft",
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { role } = request.jwtPayload;
      if (role !== "admin") {
        return reply.status(403).send({ error: "Forbidden" });
      }
      if (!mistralApiKey) {
        return reply.status(501).send({ error: "IA non configurée" });
      }
      const parse = aiDraftSchema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({ error: parse.error.flatten() });
      }

      const { emailSubject, emailBody, instruction } = parse.data;
      const result = await chatComplete(
        [
          {
            role: "system" as const,
            content:
              "Tu es un assistant administratif pour Praxisa, un organisme de formation. Tu rédiges des réponses professionnelles aux emails d’admission en français. Sois chaleureux mais professionnel. Réponds uniquement avec le corps de l’email, sans objet ni signature.",
          },
          {
            role: "user" as const,
            content: `Email reçu :\nObjet : ${emailSubject}\n\n${emailBody}\n\nInstruction : ${instruction}`,
          },
        ],
        MISTRAL_SMALL,
        mistralApiKey,
      );

      return reply.send({ draft: result });
    },
  );
}
