/**
 * `@connected/ui` — the ConnectEd design system.
 *
 * Tokens plus the primitives the product is built from. Consumers import `@connected/ui/styles.css`
 * once at the app root and then use the components; nothing here needs per-app CSS.
 *
 * Owned by the ui-designer charter (`packages/CLAUDE.md`).
 */
export { Button, type ButtonProps, type ButtonSize, type ButtonVariant } from './components/button';
export { Field, type FieldProps } from './components/field';
export { Table, type TableColumn, type TableProps } from './components/table';
export { Dialog, type DialogProps } from './components/dialog';
export {
  Alert,
  Badge,
  verificationTone,
  type AlertProps,
  type BadgeProps,
  type StatusTone,
} from './components/status';
export {
  Card,
  PageHeader,
  Stack,
  type CardProps,
  type PageHeaderProps,
  type StackProps,
} from './components/layout';
export {
  contrastRatio,
  darkPalette,
  lightPalette,
  palettes,
  relativeLuminance,
  type ThemeName,
  type ThemePalette,
} from './tokens';
