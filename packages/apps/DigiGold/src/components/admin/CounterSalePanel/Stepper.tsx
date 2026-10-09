import { cn } from '@/lib/utils/cn';
import styles from './Stepper.module.scss';

export type StepperStep = {
  title: string;
  done: boolean;
};

type StepperProps = {
  steps: StepperStep[];
  // 1-based index of the step being shown.
  current: number;
};

// Horizontal progress header: finished steps show a tick, the current one is highlighted.
export function Stepper({ steps, current }: StepperProps) {
  return (
    <ol className={styles.stepper} aria-label="Counter sale steps">
      {steps.map((step, index) => {
        const number = index + 1;
        const isCurrent = number === current;
        return (
          <li
            key={step.title}
            className={cn(
              styles.item,
              step.done && styles.done,
              isCurrent && styles.current,
            )}
            aria-current={isCurrent ? 'step' : undefined}
          >
            <span className={styles.marker} aria-hidden>
              {step.done && !isCurrent ? (
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
              ) : (
                number
              )}
            </span>
            <span className={styles.label}>
              {step.title}
              {step.done && !isCurrent && (
                <span className={styles.srOnly}> (completed)</span>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
