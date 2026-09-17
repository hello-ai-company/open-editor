/**
 * Additive `./react` entry — React hooks, palette, power blocks, and schema factory.
 * Main package entry still re-exports these for 0.1.0 compatibility.
 * 4F-2 may narrow the root entry to adapter/bridge/commands only.
 */
export {
  createCalloutBlockSpec,
  calloutVariants,
  type CalloutVariant
} from "../schema/callout.js";
export {
  createStatusBlockSpec,
  statusStates,
  type StatusState
} from "../schema/status.js";
export {
  createOpenEditorBlockNoteSchema,
  createPowerEditorOptions,
  createPowerSchema,
  DEFAULT_POWER_TABLE_OPTIONS,
  type AdditionalInlineContentSpecs,
  type CreateOpenEditorBlockNoteSchemaOptions,
  type OpenEditorBlockNoteSchema,
  type PowerEditorOptions
} from "../schema/createOpenEditorBlockNoteSchema.js";
export {
  getPowerSlashItems,
  PowerCommandPalette,
  useOpenEditorBlockChanges,
  usePowerCommandPaletteShortcut,
  type PowerCommandPaletteProps,
  type UseOpenEditorBlockChangesOptions
} from "./powerUi.js";
