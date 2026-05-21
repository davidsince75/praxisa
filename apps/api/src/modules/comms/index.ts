import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import type { CommsConfig } from "./service.js";
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendEnrolmentConfirmation,
  sendCourseCompletionEmail,
  sendCampaignEmail,
} from "./service.js";

export interface CommsPluginOptions {
  brevoApiKey: string;
  senderEmail: string;
  senderName: string;
  appBaseUrl: string;
}

// Bound comms service attached to fastify instance.
export interface CommsService {
  sendVerificationEmail: (
    to: { email: string; firstName: string },
    token: string,
  ) => Promise<void>;
  sendPasswordResetEmail: (
    to: { email: string; firstName: string },
    token: string,
  ) => Promise<void>;
  sendEnrolmentConfirmation: (
    to: { email: string; firstName: string },
    course: { id: string; title: string },
  ) => Promise<void>;
  sendCourseCompletionEmail: (
    to: { email: string; firstName: string },
    courseTitle: string,
  ) => Promise<void>;
  sendCampaignEmail: (
    to: { email: string; name: string },
    subject: string,
    body: string,
  ) => Promise<void>;
}

export const commsPlugin = fp(
  (
    fastify: FastifyInstance,
    opts: CommsPluginOptions,
    done: (err?: Error) => void,
  ) => {
    const config: CommsConfig = {
      brevoApiKey: opts.brevoApiKey,
      senderEmail: opts.senderEmail,
      senderName: opts.senderName,
      appBaseUrl: opts.appBaseUrl,
    };

    const service: CommsService = {
      sendVerificationEmail: (to, token) =>
        sendVerificationEmail(config, to, token),
      sendPasswordResetEmail: (to, token) =>
        sendPasswordResetEmail(config, to, token),
      sendEnrolmentConfirmation: (to, course) =>
        sendEnrolmentConfirmation(config, to, course),
      sendCourseCompletionEmail: (to, courseTitle) =>
        sendCourseCompletionEmail(config, to, courseTitle),
      sendCampaignEmail: (to, subject, body) =>
        sendCampaignEmail(config, to, subject, body),
    };

    fastify.decorate("comms", service);
    done();
  },
  { name: "comms" },
);

declare module "fastify" {
  interface FastifyInstance {
    comms: CommsService;
  }
}
