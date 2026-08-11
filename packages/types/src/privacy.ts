/**
 * Subject rights — export and erasure (`.docs/PRD/14-export-and-erasure.md`).
 *
 * Two flows that look alike and are not. An **export** is a read: it produces a copy and changes
 * nothing. An **erasure** is the only irreversible action in the product — which is why it is
 * scheduled rather than performed, and why the response to requesting one is a date rather than a
 * confirmation.
 */
import { z } from 'zod';

export const DataExportStatus = {
  PENDING: 'PENDING',
  BUILDING: 'BUILDING',
  READY: 'READY',
  FAILED: 'FAILED',
  EXPIRED: 'EXPIRED',
} as const;
export type DataExportStatus = (typeof DataExportStatus)[keyof typeof DataExportStatus];

/**
 * What the owner sees about their own request. Deliberately not the object key: the only way to
 * reach the bundle is the download endpoint, which authorizes and then signs (FR-DSR-004).
 */
export interface DataExportResponse {
  id: string;
  status: DataExportStatus;
  requestedAt: string;
  completedAt: string | null;
  /** When the bundle stops being downloadable and the object is deleted (FR-DSR-005). */
  expiresAt: string | null;
  sizeBytes: number | null;
  downloads: number;
  /** Set only on `FAILED`, and written for a person rather than for a log (FR-DSR-007). */
  error: string | null;
}

/** The short-lived URL, and when it stops working. */
export interface DataExportDownloadResponse {
  url: string;
  expiresAt: string;
}

/**
 * The bundle itself. One versioned JSON document (FR-DSR-003).
 *
 * `sections` is deliberately loose — `unknown[]` rather than a union of fifteen row shapes. The
 * bundle is an archival format read by whatever a person points at it, not a wire contract two
 * halves of this codebase agree on, and typing every row here would mean a schema change to the
 * gradebook could not ship without a change to the web app's type imports.
 */
export interface DataExportManifest {
  /** Bumped when the shape changes in a way a reader could notice. */
  schemaVersion: number;
  generatedAt: string;
  accountId: string;
  /** Section name to row count, including the sections that are empty (FR-DSR-013). */
  counts: Record<string, number>;
  /** In the file, addressed to whoever opens it. */
  notes: string[];
}

export interface DataExportBundle {
  manifest: DataExportManifest;
  sections: Record<string, unknown[]>;
}

/**
 * Requesting erasure. The reason is optional and stays optional — a right you have to justify is
 * not a right.
 */
export const requestErasureSchema = z.object({
  reason: z.string().trim().max(1000).optional(),
  /**
   * A deliberate speed bump, not a security control. Erasure is irreversible after the grace
   * period and this is the last screen before it; a checkbox is easy to click past, and typing the
   * word is not.
   */
  confirm: z.literal('ERASE'),
});

export type RequestErasureInput = z.infer<typeof requestErasureSchema>;

export interface ErasureRequestResponse {
  id: string;
  requestedAt: string;
  /** When it executes if nobody cancels (FR-DSR-021). */
  scheduledFor: string;
  cancelledAt: string | null;
  executedAt: string | null;
  reason: string | null;
}

/** The state of both rights for the signed-in account, in one read. */
export interface PrivacyStatusResponse {
  /** The most recent export request, or null if there has never been one. */
  latestExport: DataExportResponse | null;
  /** The live erasure request — pending, not cancelled, not executed. */
  pendingErasure: ErasureRequestResponse | null;
  /** False for a school account: it is a controller, not merely a subject (FR-DSR-020). */
  mayErase: boolean;
}
