import Link from 'next/link';
import { cn } from '@/lib/utils/cn';
import { ICON_REGISTRY } from '@/components/common/icons/iconRegistry';
import type { HeaderAction } from './Header.types';
import styles from './Header.module.scss';

export function HeaderActionLink({
  action,
  className,
  onClick,
}: {
  action: HeaderAction;
  className?: string;
  onClick?: () => void;
}) {
  const Icon = action.icon ? ICON_REGISTRY[action.icon] : null;

  return (
    <Link
      href={action.url}
      target={action.target ?? '_self'}
      rel={action.target === '_blank' ? 'noopener noreferrer' : undefined}
      className={cn(action.type === 'button' ? styles.actionButton : styles.actionLink, className)}
      onClick={onClick}
    >
      {Icon && <Icon width={16} height={16} />}
      {action.label}
    </Link>
  );
}
