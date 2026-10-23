import {
  MAX_LAYOUT_BLOCKS,
  MAX_LAYOUT_DEPTH,
  type LayoutBlock,
} from './layout.types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const TYPE_PATTERN = /^[A-Za-z][A-Za-z0-9]{0,39}$/;
const DEFAULT_VARIANT = '1';

function identifier(value: unknown): string | null {
  if (typeof value === 'string' && value.trim())
    return value.trim().slice(0, 80);
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

type ParseState = { count: number; usedIds: Set<string> };

// React keys must be unique, so a repeated id keeps its place but gets a suffix.
function uniqueId(candidate: string, state: ParseState): string {
  let id = candidate;
  for (let n = 2; state.usedIds.has(id); n += 1) id = `${candidate}-${n}`;
  state.usedIds.add(id);
  return id;
}

function parseBlocks(
  raw: unknown,
  depth: number,
  state: ParseState,
): LayoutBlock[] {
  if (!Array.isArray(raw) || depth > MAX_LAYOUT_DEPTH) return [];

  const blocks: LayoutBlock[] = [];
  for (const [index, item] of raw.entries()) {
    if (state.count >= MAX_LAYOUT_BLOCKS) break;
    if (!isRecord(item)) continue;

    const type = typeof item.type === 'string' ? item.type.trim() : '';
    if (!TYPE_PATTERN.test(type)) continue;

    state.count += 1;
    blocks.push({
      id: uniqueId(
        identifier(item.id) ?? `${type}-${state.count}-${index}`,
        state,
      ),
      type,
      variant: identifier(item.variant) ?? DEFAULT_VARIANT,
      props: isRecord(item.props) ? item.props : {},
      children: parseBlocks(item.children, depth + 1, state),
    });
  }
  return blocks;
}

// ui_json_config is a published array of blocks, but the same column also holds the tenant
// theme object, so an object may carry the blocks under `layout`. Anything else (null, a
// string, `{}`) is simply an empty layout. Never throws.
export function parseLayout(uiConfig: unknown): LayoutBlock[] {
  const raw = Array.isArray(uiConfig)
    ? uiConfig
    : isRecord(uiConfig)
      ? uiConfig['layout']
      : undefined;
  return parseBlocks(raw, 1, { count: 0, usedIds: new Set() });
}
