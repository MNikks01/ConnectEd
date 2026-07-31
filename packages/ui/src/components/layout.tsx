'use client';

/**
 * Layout primitives — Card, Stack, and PageHeader.
 *
 * Small, but they are what stop every page inventing its own margins. Spacing comes from the token
 * scale, so vertical rhythm is consistent without anyone measuring it.
 */
import type { ElementType, ReactNode } from 'react';

export interface CardProps {
  children: ReactNode;
  /** Renders as `<section>` etc. when the card is a real landmark rather than a box. */
  as?: ElementType;
}

export function Card({ children, as: Tag = 'div' }: CardProps) {
  return <Tag className="ui-card">{children}</Tag>;
}

export interface StackProps {
  children: ReactNode;
  /** Token step 1–7. */
  gap?: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  direction?: 'column' | 'row';
  align?: 'start' | 'center' | 'end' | 'between';
}

export function Stack({ children, gap = 4, direction = 'column', align }: StackProps) {
  return (
    <div
      className="ui-stack"
      data-direction={direction}
      data-align={align}
      style={{ gap: `var(--ui-space-${gap})` }}
    >
      {children}
    </div>
  );
}

export interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** Actions sit opposite the title and wrap below it on narrow screens. */
  actions?: ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <header className="ui-page-header">
      <div>
        <h1 className="ui-page-header__title">{title}</h1>
        {description ? <p className="ui-page-header__description">{description}</p> : null}
      </div>
      {actions ? <div className="ui-page-header__actions">{actions}</div> : null}
    </header>
  );
}
