type TreeBlock = { id: string; children?: readonly TreeBlock[] };
export type NotesBlockMove = "moveUp" | "moveDown" | "moveTop" | "moveBottom";
/** Reorder one block in its existing sibling list, keeping its children and
 * unknown props intact. Never promote it or move it into another parent. */
export function notesMoveBlock<T extends TreeBlock>(blocks: readonly T[], id: string, move: NotesBlockMove): readonly T[] {
  const index = blocks.findIndex(block => block.id === id);
  if (index >= 0) {
    const destination = move === "moveUp" ? index - 1 : move === "moveDown" ? index + 1 : move === "moveTop" ? 0 : blocks.length - 1;
    if (destination < 0 || destination >= blocks.length || destination === index) return blocks;
    const next = [...blocks]; next.splice(index, 1); next.splice(destination, 0, blocks[index]!); return next;
  }
  for (let index = 0; index < blocks.length; index++) {
    const block = blocks[index]!;
    if (!block.children?.length) continue;
    const children = notesMoveBlock(block.children, id, move);
    if (children === block.children) continue;
    const next = [...blocks]; next[index] = { ...block, children } as T; return next;
  }
  return blocks;
}
