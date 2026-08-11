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
import { formatShortDate } from '@/lib/i18n/format';
import { useTranslations } from './locale-provider';

import type { TimetableResponse } from '@connected/types';

function FileField() {
  const { t } = useTranslations();

  return (
    <Field
      name="file"
      label={t('timetablePanel.image')}
      type="file"
      accept="image/jpeg,image/png,image/webp"
      required
      error={useFieldError('file')}
      hint={t('timetablePanel.imageHint')}
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
  const { t, locale } = useTranslations();

  return (
    <div style={{ display: 'grid', gap: 'var(--ui-space-4)' }}>
      {timetable?.imageUrl ? (
        <figure style={{ margin: 0 }}>
          {/* A signed URL that expires — `next/image` would proxy and cache it. */}
          <img
            src={timetable.imageUrl}
            alt={t('timetablePanel.imageAlt', { version: timetable.version })}
            style={{ maxWidth: '100%', height: 'auto', borderRadius: 'var(--ui-radius)' }}
          />
          <figcaption className="muted" style={{ fontSize: 'var(--ui-text-sm)' }}>
            {t('timetablePanel.caption', {
              version: timetable.version,
              date: formatShortDate(timetable.createdAt, locale),
            })}
          </figcaption>
        </figure>
      ) : timetable?.kind === 'STRUCTURED' ? (
        <p className="muted" style={{ margin: 0 }}>
          {t(
            timetable.periods.length === 1
              ? 'timetablePanel.structuredOne'
              : 'timetablePanel.structuredMany',
            {
              version: timetable.version,
              count: timetable.periods.length,
              date: formatShortDate(timetable.createdAt, locale),
              next: timetable.version + 1,
            },
          )}
        </p>
      ) : (
        <p className="muted" style={{ margin: 0 }}>
          {t('timetablePanel.none')}
        </p>
      )}

      <ActionForm
        action={uploadTimetableAction.bind(null, classId)}
        submitLabel={t('timetablePanel.submit')}
        pendingLabel={t('timetablePanel.uploading')}
        successMessage={t('timetablePanel.uploaded')}
        resetOnSuccess
      >
        <FileField />
      </ActionForm>
    </div>
  );
}
