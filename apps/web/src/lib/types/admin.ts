// Campaigns, tags, forums, settings, Gmail, payments, files — shared API response types.
// Split out of lib/api.ts; consumed via re-export from @/lib/api.

// ── Campaigns ──────────────────────────────────────────────────────────────────

export type CampaignStatus = "draft" | "sending" | "sent" | "failed";
export type CampaignTarget = "all_students" | "course_enrolled";
export type CampaignDeliveryType = "internal" | "external" | "targeted";

export interface Campaign {
  id: string;
  name: string;
  subject: string | null;
  body: string;
  deliveryType: CampaignDeliveryType;
  targetType: CampaignTarget;
  targetCourseId: string | null;
  status: CampaignStatus;
  recipientCount: number | null;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignsResponse {
  campaigns: Campaign[];
}

export interface CampaignResponse {
  campaign: Campaign;
}

export interface CampaignSendResponse {
  sent: number;
  recipientCount: number;
}

// ── Tags ─────────────────────────────────────────────────────────────────────

export interface TagRow {
  id: string;
  name: string;
  color: string;
  userId: string;
  createdAt: string;
}

export interface TagsResponse {
  tags: TagRow[];
}

// ── Discussion Forums ────────────────────────────────────────────────────────

export interface ForumThreadRow {
  id: string;
  courseId: string;
  lessonId: string | null;
  title: string;
  body: string;
  isPinned: boolean;
  isLocked: boolean;
  createdAt: string;
  authorId: string;
  authorFirstName: string;
  authorLastName: string;
  authorRole: string;
  replyCount: number;
}

export interface ForumReplyRow {
  id: string;
  body: string;
  createdAt: string;
  authorId: string;
  authorFirstName: string;
  authorLastName: string;
  authorRole: string;
}

export interface ForumThreadsResponse {
  threads: ForumThreadRow[];
}

export interface ForumThreadDetailResponse {
  thread: ForumThreadRow & { replyCount?: number };
  replies: ForumReplyRow[];
}

// ── Settings ─────────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  createdAt: string;
}

export interface ProfileResponse {
  profile: UserProfile;
}

export interface EmailNotificationPrefs {
  messages: boolean;
  grading: boolean;
  campaigns: boolean;
  forums: boolean;
}

export interface UserPreferencesData {
  theme: string;
  locale: string;
  emailNotifications: EmailNotificationPrefs;
}

export interface PreferencesResponse {
  preferences: UserPreferencesData;
}

// ── Gmail ───────────────────────────────────────────────────────────────────────

export interface GmailStatus {
  connected: boolean;
  email?: string;
  connectedAt?: string;
}

export interface GmailAuthUrlResponse {
  url: string;
}

export interface GmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  from: string;
  subject: string;
  date: string;
  labelIds: string[];
  isUnread: boolean;
}

export interface GmailMessagesResponse {
  messages: GmailMessage[];
  nextPageToken: string | null;
}

export interface GmailMessageDetail {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  body: string;
  labelIds: string[];
}

export interface GmailAiDraftResponse {
  draft: string;
}

// ── Payments (GoCardless) ───────────────────────────────────────────────────────

export interface PaymentStatusResponse {
  connected: boolean;
}

export interface PaymentItem {
  id: string;
  amount: number;
  currency: string;
  status: string;
  description: string | null;
  reference: string | null;
  createdAt: string;
  chargeDate: string | null;
  metadata: Record<string, string>;
}

export interface PaymentsListResponse {
  payments: PaymentItem[];
  nextCursor: string | null;
}

export interface PaymentLinkResponse {
  id: string;
  paymentUrl: string;
}

// ── Uploaded Files ────────────────────────────────────────────────────────────

export interface UploadedFile {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
}

export interface UploadFileResponse {
  file: UploadedFile;
}
