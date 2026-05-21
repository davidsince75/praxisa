import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "../../db/schema/index.js";
import { notifications } from "../../db/schema/index.js";

type Db = NodePgDatabase<typeof schema>;
type NotificationType =
  | "new_message"
  | "grading_returned"
  | "campaign_sent"
  | "enrolment_created";

export async function createNotification(
  db: Db,
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
  entityType?: string,
  entityId?: string,
): Promise<void> {
  await db
    .insert(notifications)
    .values({ userId, type, title, body, entityType, entityId });
}
