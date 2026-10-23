'use client';

import { useId } from 'react';
import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/common/Button/Button';
import type { HeroProps } from '@/features/layout/layout.props';
import type { BlockContext } from '../../layout.registry';
import { useBuyAction } from '../../useBuyAction';
import styles from './HeroBlock.module.scss';

type HeroBlockProps = { props: HeroProps; context: BlockContext };

export function HeroBlock({ props, context }: HeroBlockProps) {
  const headingId = useId();
  const { canBuy, startBuy, buyDialog } = useBuyAction();
  const { title, subtitle, ctaText, backgroundColor, textColor } = props;
  // One h1 per page: a second hero is still a titled section, just not the page title.
  const Heading = context.isFirstOfType ? 'h1' : 'h2';

  // Without a tenant colour the hero keeps the neutral surface, whose text colour is known
  // to be readable; with one, the text colour was computed from it.
  const custom = backgroundColor && textColor ? { backgroundColor, textColor } : null;

  return (
    <section
      className={cn(styles.hero, custom && styles.filled)}
      style={custom ? { background: custom.backgroundColor, color: custom.textColor } : undefined}
      aria-labelledby={headingId}
    >
      <Heading id={headingId} className={styles.title}>
        {title}
      </Heading>
      <p className={styles.subtitle}>{subtitle}</p>
      {canBuy && (
        <Button
          className={styles.cta}
          style={
            custom ? { background: custom.textColor, color: custom.backgroundColor } : undefined
          }
          onClick={startBuy}
        >
          {ctaText}
        </Button>
      )}
      {buyDialog}
    </section>
  );
}
