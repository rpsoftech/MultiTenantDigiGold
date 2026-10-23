import { parseHeaderProps, type HeaderProps } from './layout.props';
import type { LayoutBlock } from './layout.types';

// The Header block does not render in the page body (the shell already owns the header and
// its navigation); its props brand that single header instead.
export function selectHeaderOverride(
  layout: LayoutBlock[] | null | undefined,
): HeaderProps | null {
  const block = layout?.find(
    (item) => item.type === 'Header' && item.variant === '1',
  );
  return block ? parseHeaderProps(block.props) : null;
}
