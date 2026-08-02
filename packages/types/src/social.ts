/**
 * The social layer (`.docs/PRD/06-social.md`).
 *
 * Open to every account type, verified or not — the first module in this product that is not gated
 * by a school's approval.
 */
import { z } from 'zod';

export const ProfileVisibility = {
  PUBLIC: 'PUBLIC',
  CONNECTIONS: 'CONNECTIONS',
} as const;
export type ProfileVisibility = (typeof ProfileVisibility)[keyof typeof ProfileVisibility];

export const updateProfileSchema = z.object({
  fullName: z.string().trim().min(1).max(120).optional(),
  bio: z.string().trim().max(1000).nullish(),
  achievements: z.string().trim().max(2000).nullish(),
  displayPicKey: z.string().trim().max(300).nullish(),
  visibility: z.enum(ProfileVisibility).optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

/**
 * What anyone signed in may see: enough to recognise someone and ask to connect, and no more.
 * Returned for every profile regardless of its visibility setting.
 */
export interface ProfileCardResponse {
  accountId: string;
  accountType: 'INDIVIDUAL' | 'SCHOOL';
  displayName: string;
  handle: string | null;
  /** Short-lived signed URL, or null when there is no picture. */
  displayPicUrl: string | null;
}

/**
 * The full profile. `restricted` is true when the caller was shown the card only — stated in the
 * response rather than left as an absence, so a client can say "this profile is private" instead
 * of rendering an empty page.
 */
export interface ProfileResponse extends ProfileCardResponse {
  restricted: boolean;
  bio?: string | null;
  achievements?: string | null;
  /** Only ever present on your own profile. */
  visibility?: ProfileVisibility;
  /** Individuals only; a school has none of these. */
  role?: string | null;
  /** Schools only. */
  city?: string | null;
  about?: string | null;
}

export const createPostSchema = z.object({
  body: z.string().trim().min(1).max(5000),
  /** A key from `POST /media/posts`; the signed URL is issued on read. */
  imageKey: z.string().trim().max(300).nullish(),
});

export const updatePostSchema = z.object({
  body: z.string().trim().min(1).max(5000).optional(),
  imageKey: z.string().trim().max(300).nullish(),
});

export type CreatePostInput = z.infer<typeof createPostSchema>;
export type UpdatePostInput = z.infer<typeof updatePostSchema>;

export interface PostResponse {
  id: string;
  author: ProfileCardResponse;
  body: string;
  /** Short-lived signed URL, issued only after the caller has been authorized. */
  imageUrl: string | null;
  likeCount: number;
  commentCount: number;
  /** Whether *this* caller has liked it. */
  liked: boolean;
  /** True when the caller wrote it — what the client uses to offer edit and delete. */
  mine: boolean;
  createdAt: string;
  editedAt: string | null;
}

export const createCommentSchema = z.object({
  body: z.string().trim().min(1).max(2000),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;

export interface CommentResponse {
  id: string;
  postId: string;
  author: ProfileCardResponse;
  body: string;
  /** True when the caller wrote it — what the client uses to offer delete. */
  mine: boolean;
  createdAt: string;
}

export interface LikeResponse {
  postId: string;
  liked: boolean;
  likeCount: number;
}

export const ConnectionStatus = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
} as const;
export type ConnectionStatus = (typeof ConnectionStatus)[keyof typeof ConnectionStatus];

export const requestConnectionSchema = z.object({
  accountId: z.uuid(),
});

export type RequestConnectionInput = z.infer<typeof requestConnectionSchema>;

export interface FollowStateResponse {
  accountId: string;
  following: boolean;
  followerCount: number;
  followingCount: number;
}

export interface ConnectionResponse {
  id: string;
  status: ConnectionStatus;
  /** The other party, whichever side of the pair they are stored on. */
  other: ProfileCardResponse;
  /** True when the caller sent it — what tells "waiting on them" from "waiting on you". */
  requestedByMe: boolean;
  createdAt: string;
}

export const startThreadSchema = z.object({
  accountId: z.uuid(),
});

export const sendMessageSchema = z.object({
  body: z.string().trim().min(1).max(5000),
});

export type StartThreadInput = z.infer<typeof startThreadSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export interface MessageResponse {
  id: string;
  threadId: string;
  senderAccountId: string;
  body: string;
  mine: boolean;
  /** When the recipient read it. Null while unread; only ever set on the recipient's copy. */
  readAt: string | null;
  createdAt: string;
}

export interface ThreadResponse {
  id: string;
  other: ProfileCardResponse;
  /** The most recent message, for the inbox line. Null on a thread with nothing said yet. */
  lastMessage: { body: string; mine: boolean; createdAt: string } | null;
  /** Messages from the other party that this caller has not read. */
  unreadCount: number;
  updatedAt: string;
}

export interface InboxResponse {
  data: ThreadResponse[];
  /** Across every thread — what the badge shows (FR-SOC-021). */
  unreadTotal: number;
}

export const ReportSubject = {
  POST: 'POST',
  COMMENT: 'COMMENT',
  MESSAGE: 'MESSAGE',
  ACCOUNT: 'ACCOUNT',
} as const;
export type ReportSubject = (typeof ReportSubject)[keyof typeof ReportSubject];

export const createReportSchema = z.object({
  subjectType: z.enum(ReportSubject),
  subjectId: z.uuid(),
  reason: z.string().trim().min(1).max(2000),
});

export type CreateReportInput = z.infer<typeof createReportSchema>;

export interface ReportResponse {
  id: string;
  subjectType: ReportSubject;
  subjectId: string;
  reason: string;
  status: 'OPEN' | 'REVIEWED' | 'ACTIONED' | 'DISMISSED';
  createdAt: string;
}

export interface BlockResponse {
  accountId: string;
  blocked: boolean;
}

export interface BlockListResponse {
  data: ProfileCardResponse[];
}
