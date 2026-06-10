// Conversations, messages, notifications — shared API response types.
// Split out of lib/api.ts; consumed via re-export from @/lib/api.

// ── Messaging ──────────────────────────────────────────────────────────────────

export interface MessageParticipant {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
}

export interface MessageItem {
  id: string;
  threadId: string;
  senderId: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export interface MessageThread {
  id: string;
  courseId: string | null;
  updatedAt: string;
  other: MessageParticipant | null;
  lastMessage: MessageItem | null;
  unreadCount: number;
}

export interface MessageThreadsResponse {
  threads: MessageThread[];
}

export interface MessageThreadDetailResponse {
  thread: {
    id: string;
    participantA: string;
    participantB: string;
    courseId: string | null;
    createdAt: string;
    updatedAt: string;
  };
  messages: MessageItem[];
}

export interface SendMessageResponse {
  threadId: string;
  message: MessageItem;
}

export interface UnreadCountResponse {
  unread: number;
}

// ── Notifications ─────────────────────────────────────────────────────────────

export type NotificationType =
  | "new_message"
  | "grading_returned"
  | "campaign_sent"
  | "enrolment_created";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  entityType: string | null;
  entityId: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
}
