/**
 * A report card, as a family reads it (FR-GRADE-032 … 036).
 *
 * A server component: there is nothing to interact with. A card is a document, and the whole point
 * of the feature is that what it says was decided when it was issued — so this renders the stored
 * snapshot and computes nothing. If a number here were derived at render time, correcting a mark
 * would change a document somebody already has, which is the thing the server went to some trouble
 * to prevent.
 *
 * What is deliberately absent is as much of the design as what is present: no rank, no class
 * average, no position, no letter grade. The card says what a family is owed about their own child.
 */
import { Card } from '@connected/ui';

import type { CardSubject, ReportCardResponse } from '@connected/types';

function Percent({ value }: { value: number | null }) {
  // "Not graded" rather than 0%, everywhere a percentage can be absent. A child with nothing marked
  // has no percentage, and a nought would be a claim about them that nobody made.
  return <>{value === null ? 'Not graded' : `${value}%`}</>;
}

function Subject({ subject }: { subject: CardSubject }) {
  return (
    <section style={{ marginTop: 'var(--ui-space-4)' }}>
      <h4 style={{ margin: '0 0 var(--ui-space-1)', fontSize: 'var(--ui-font-size-2)' }}>
        {subject.subjectName}
      </h4>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th scope="col" style={{ textAlign: 'left' }}>
              Assessment
            </th>
            <th scope="col" style={{ textAlign: 'left' }}>
              Date
            </th>
            <th scope="col" style={{ textAlign: 'left' }}>
              Score
            </th>
          </tr>
        </thead>
        <tbody>
          {subject.assessments.map((assessment) => (
            <tr key={`${assessment.title}-${assessment.occurredOn}`}>
              <td>{assessment.title}</td>
              <td>{assessment.occurredOn}</td>
              <td>
                {/* "Not marked", and the row stays: the card is honest that the work was set, and
                    the totals below are honest that it did not count. */}
                {assessment.score === null
                  ? 'Not marked'
                  : `${assessment.score} / ${assessment.maxScore}`}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" style={{ textAlign: 'left' }}>
              Total
            </th>
            <td />
            <td>
              <strong>
                {subject.scored} / {subject.available}
              </strong>{' '}
              (<Percent value={subject.percent} />)
            </td>
          </tr>
        </tfoot>
      </table>
    </section>
  );
}

export function ReportCardView({ card }: { card: ReportCardResponse }) {
  const { snapshot } = card;

  return (
    <Card>
      <h3 style={{ margin: '0 0 var(--ui-space-1)', fontSize: 'var(--ui-font-size-3)' }}>
        {card.studentName} — {card.termName}
      </h3>

      <p style={{ margin: '0 0 var(--ui-space-3)', color: 'var(--ui-color-text-muted)' }}>
        Issued {card.issuedAt.slice(0, 10)}
        {card.replacedIssuedAt ? (
          // A reissue says so on its face (FR-GRADE-042). A family holding the earlier one can see
          // that theirs was superseded, which is the whole reason the date is kept.
          <> · replaces the card issued {card.replacedIssuedAt.slice(0, 10)}</>
        ) : null}
      </p>

      {snapshot.subjects.length === 0 ? (
        <p style={{ margin: 0 }}>
          No published assessments fell within this term, so there is nothing to report.
        </p>
      ) : (
        snapshot.subjects.map((subject) => <Subject key={subject.subjectName} subject={subject} />)
      )}

      {snapshot.subjects.length > 0 ? (
        <p style={{ marginTop: 'var(--ui-space-4)' }}>
          <strong>Overall: </strong>
          <Percent value={snapshot.overallPercent} />
        </p>
      ) : null}

      <section style={{ marginTop: 'var(--ui-space-4)' }}>
        <h4 style={{ margin: '0 0 var(--ui-space-1)', fontSize: 'var(--ui-font-size-2)' }}>
          Attendance
        </h4>
        {/* Four counts and no percentage: "attendance below 90%" is a threshold, and a threshold is
            a policy with consequences that this product does not hold (FR-GRADE-034). */}
        <p style={{ margin: 0 }}>
          Present {snapshot.attendance.present} · Absent {snapshot.attendance.absent} · Late{' '}
          {snapshot.attendance.late} · Excused {snapshot.attendance.excused}
        </p>
      </section>

      {card.comment ? (
        <section style={{ marginTop: 'var(--ui-space-4)' }}>
          <h4 style={{ margin: '0 0 var(--ui-space-1)', fontSize: 'var(--ui-font-size-2)' }}>
            Comment
          </h4>
          <p style={{ margin: 0 }}>{card.comment}</p>
        </section>
      ) : null}
    </Card>
  );
}
