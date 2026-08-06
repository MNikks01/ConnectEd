'use client';

/**
 * Timetable upload, for the school portal.
 *
 * The current one is shown above the control: a school replacing a timetable should see what it
 * is replacing, and the version number is what tells them the upload actually landed.
 */
import { Field } from '@connected/ui';

import { uploadTimetableAction } from '@/app/(app)/school/actions';
import { ActionForm, useFieldError } from './action-form';

import type { TimetableResponse } from '@connected/types';

function FileField() {
  return (
    <Field
      name="file"
      label="Timetable image"
      type="file"
      accept="image/jpeg,image/png,image/webp"
      required
      error={useFieldError('file')}
      hint="JPEG, PNG, or WebP. Uploading again keeps the old one as an earlier version."
    />
  );
}

export function TimetablePanel({
  classId,
  timetable,
}: {
  classId: string;
  timetable: TimetableResponse | undefined;
}) {
  return (
    <div style={{ display: 'grid', gap: 'var(--ui-space-4)' }}>
      {timetable?.imageUrl ? (
        <figure style={{ margin: 0 }}>
          {/* A signed URL that expires — `next/image` would proxy and cache it. */}
          <img
            src={timetable.imageUrl}
            alt={`Timetable, version ${timetable.version}`}
            style={{ maxWidth: '100%', height: 'auto', borderRadius: 'var(--ui-radius)' }}
          />
          <figcaption className="muted" style={{ fontSize: 'var(--ui-text-sm)' }}>
            Version {timetable.version}, uploaded{' '}
            {new Date(timetable.createdAt).toLocaleDateString('en-GB')}
          </figcaption>
        </figure>
      ) : timetable?.kind === 'STRUCTURED' ? (
        <p className="muted" style={{ margin: 0 }}>
          Version {timetable.version} is a structured week of {timetable.periods.length}{' '}
          {timetable.periods.length === 1 ? 'period' : 'periods'}, published{' '}
          {new Date(timetable.createdAt).toLocaleDateString('en-GB')}. Uploading an image below
          replaces it with version {timetable.version + 1}; the week stays readable in the history.
        </p>
      ) : (
        <p className="muted" style={{ margin: 0 }}>
          No timetable yet. Members of this class see nothing until one is published.
        </p>
      )}

      <ActionForm
        action={uploadTimetableAction.bind(null, classId)}
        submitLabel="Upload timetable"
        pendingLabel="Uploading…"
        successMessage="Timetable uploaded."
        resetOnSuccess
      >
        <FileField />
      </ActionForm>
    </div>
  );
}
