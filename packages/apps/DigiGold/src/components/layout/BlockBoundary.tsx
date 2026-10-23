'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';

type BlockBoundaryProps = { blockKey: string; children: ReactNode };
type BlockBoundaryState = { failed: boolean };

// One broken block must not take the rest of the storefront down with it: it renders
// nothing and the neighbouring blocks carry on.
export class BlockBoundary extends Component<BlockBoundaryProps, BlockBoundaryState> {
  override state: BlockBoundaryState = { failed: false };

  static getDerivedStateFromError(): BlockBoundaryState {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[layout] block ${this.props.blockKey} failed to render`, error, info);
  }

  override render() {
    return this.state.failed ? null : this.props.children;
  }
}
