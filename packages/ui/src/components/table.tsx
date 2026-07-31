'use client';

/**
 * Data table.
 *
 * A real `<table>` with `<th scope>`, not a grid of divs — screen readers announce "column X,
 * row Y" from that structure, and nothing replicates it with ARIA cheaply or correctly.
 *
 * `caption` is required rather than optional. A table without one is an unnamed landmark: a
 * screen-reader user tabbing into it has no idea what they are reading. `captionVisible={false}`
 * hides it visually while keeping it announced, for the common case where a nearby heading already
 * says it to sighted users.
 *
 * The empty state is part of the component. A table that renders as a bare header row when there
 * is nothing to show reads as broken rather than as empty.
 */
import type { ReactNode } from 'react';

export interface TableColumn<Row> {
  key: string;
  header: ReactNode;
  render: (row: Row) => ReactNode;
  /** Numeric columns read better right-aligned. */
  align?: 'start' | 'end';
}

export interface TableProps<Row> {
  caption: ReactNode;
  captionVisible?: boolean;
  columns: TableColumn<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  empty?: ReactNode;
}

export function Table<Row>({
  caption,
  captionVisible = true,
  columns,
  rows,
  rowKey,
  empty = 'Nothing to show yet.',
}: TableProps<Row>) {
  return (
    // Wide tables scroll inside their own container rather than pushing the page sideways.
    <div className="ui-table__scroll">
      <table className="ui-table">
        <caption className={captionVisible ? 'ui-table__caption' : 'ui-visually-hidden'}>
          {caption}
        </caption>

        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                style={column.align === 'end' ? { textAlign: 'end' } : undefined}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="ui-table__empty" colSpan={columns.length}>
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={rowKey(row)}>
                {columns.map((column) => (
                  <td
                    key={column.key}
                    style={column.align === 'end' ? { textAlign: 'end' } : undefined}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
