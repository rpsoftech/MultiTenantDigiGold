import type { ReactNode } from 'react';
import type { LayoutBlock } from '@/features/layout/layout.types';
import { cn } from '@/lib/utils/cn';
import { BlockBoundary } from './BlockBoundary';
import { BLOCK_REGISTRY, blockKey } from './layout.registry';
import { SectionBand } from './SectionBand/SectionBand';
import styles from './LayoutRenderer.module.scss';

type LayoutRendererProps = { blocks: LayoutBlock[] };

function renderBlocks(
  blocks: LayoutBlock[],
  seenKeys: Set<string>,
  // Top-level blocks are alternating bands; nested children stay inside their parent's.
  band?: { next: number }
): ReactNode[] {
  return blocks.flatMap((block) => {
    const key = blockKey(block.type, block.variant);
    const definition = BLOCK_REGISTRY[key];

    if (!definition) {
      // An unsupported block is skipped, not fatal: a newer admin may publish blocks this
      // build does not know yet.
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[layout] unsupported block "${key}" skipped`);
      }
      return [];
    }

    // A block that only configures something else (the Header block) has nothing to draw,
    // so it must not take a band or break the gray/white alternation.
    if (!definition.drawsContent) return [];

    const isFirstOfType = !seenKeys.has(key);
    seenKeys.add(key);

    const slot = (
      <div
        key={block.id}
        className={cn(styles.slot, definition.fullBleed && styles.slotFullBleed)}
        data-block={key}
      >
        <BlockBoundary blockKey={key}>
          {definition.render(block.props, { isFirstOfType })}
        </BlockBoundary>
        {block.children.length > 0 && (
          <div className={styles.children}>{renderBlocks(block.children, seenKeys)}</div>
        )}
      </div>
    );

    if (!band) return [slot];
    return [
      <SectionBand key={block.id} index={band.next++}>
        {slot}
      </SectionBand>,
    ];
  });
}

// Renders the published blocks in their saved order. Returns null when none of them is
// supported, so the caller can fall back to the default homepage.
export function LayoutRenderer({ blocks }: LayoutRendererProps) {
  const rendered = renderBlocks(blocks, new Set(), { next: 0 });
  if (!rendered.length) return null;

  return <div className={styles.layout}>{rendered}</div>;
}

export function hasRenderableBlock(blocks: LayoutBlock[]): boolean {
  return blocks.some(
    (block) => BLOCK_REGISTRY[blockKey(block.type, block.variant)]?.drawsContent
  );
}
