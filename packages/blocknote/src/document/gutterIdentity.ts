// Identifies an owned portal by writer, without adding attributes to SDK body DOM.
const identities = new WeakMap<object, string>();
let sequence = 0;
export function documentGutterIdentity(editor: object): string { let id = identities.get(editor); if (!id) { id = `oe-gutter-${++sequence}`; identities.set(editor, id); } return id; }
