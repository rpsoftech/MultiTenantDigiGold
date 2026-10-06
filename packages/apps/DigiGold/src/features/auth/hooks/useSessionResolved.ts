import { useEffect, useState } from 'react';

// False on the first render (including the static-export HTML), true once mount effects
// have run. SessionLifecycle restores a stored session synchronously in its own mount
// effect, in the same flush — so after this flips, `isAuthenticated: false` really means
// signed out rather than "restore still pending". Lets private pages show a loader instead
// of flashing a sign-in prompt at a logged-in user on every refresh.
export function useSessionResolved(): boolean {
  const [resolved, setResolved] = useState(false);
  useEffect(() => setResolved(true), []);
  return resolved;
}
