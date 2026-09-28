import type { JsonValue } from "@hello-ai-company/editor-core";
import { AIContractValidationError, cloneJsonValue, requireExactKeys, requireId, requireRecord, requireString, requireText, requireTimestamp } from "./validation.js";

export type LearningSignal = Readonly<{
  id: string;
  kind: "suggestion-accepted" | "suggestion-rejected" | "suggestion-edited" | "preference-feedback";
  actorId: string;
  occurredAt: string;
  runId?: string;
  suggestionId?: string;
  note?: string;
}>;

export type PreferenceProposal = Readonly<{
  schemaVersion: 1;
  status: "pending";
  id: string;
  key: string;
  value: JsonValue;
  rationale: string;
  proposedByAgentId: string;
  runId: string;
  createdAt: string;
}>;

export type PreferenceDecision =
  | Readonly<{ decision: "accept"; acceptedBy: string; decidedAt: string }>
  | Readonly<{ decision: "reject"; rejectedBy: string; decidedAt: string }>;

export type DecidedPreferenceProposal =
  | Readonly<{ status: "accepted"; proposal: PreferenceProposal; acceptedBy: string; decidedAt: string }>
  | Readonly<{ status: "rejected"; proposal: PreferenceProposal; rejectedBy: string; decidedAt: string }>;

export function parseLearningSignal(value: unknown): LearningSignal {
  const signal = requireRecord(value, "learningSignal");
  requireExactKeys(signal, ["id", "kind", "actorId", "occurredAt", "runId", "suggestionId", "note"], "learningSignal");
  const kind = requireString(signal.kind, "learningSignal.kind", 64);
  if (kind !== "suggestion-accepted" && kind !== "suggestion-rejected" && kind !== "suggestion-edited" && kind !== "preference-feedback") {
    throw new AIContractValidationError("learningSignal.kind is unsupported.");
  }
  return {
    id: requireId(signal.id, "learningSignal.id"),
    kind,
    actorId: requireId(signal.actorId, "learningSignal.actorId"),
    occurredAt: requireTimestamp(signal.occurredAt, "learningSignal.occurredAt"),
    ...(signal.runId === undefined ? {} : { runId: requireId(signal.runId, "learningSignal.runId") }),
    ...(signal.suggestionId === undefined ? {} : { suggestionId: requireId(signal.suggestionId, "learningSignal.suggestionId") }),
    ...(signal.note === undefined ? {} : { note: requireText(signal.note, "learningSignal.note", 8_000) })
  };
}

export function parsePreferenceProposal(value: unknown): PreferenceProposal {
  const proposal = requireRecord(value, "preferenceProposal");
  requireExactKeys(proposal, ["schemaVersion", "status", "id", "key", "value", "rationale", "proposedByAgentId", "runId", "createdAt"], "preferenceProposal");
  if (proposal.schemaVersion !== 1) throw new AIContractValidationError("preferenceProposal.schemaVersion must be 1.");
  if (proposal.status !== "pending") throw new AIContractValidationError("preferenceProposal.status must be 'pending'.");
  return {
    schemaVersion: 1,
    status: "pending",
    id: requireId(proposal.id, "preferenceProposal.id"),
    key: requireString(proposal.key, "preferenceProposal.key", 256),
    value: cloneJsonValue(proposal.value, "preferenceProposal.value"),
    rationale: requireText(proposal.rationale, "preferenceProposal.rationale", 8_000),
    proposedByAgentId: requireId(proposal.proposedByAgentId, "preferenceProposal.proposedByAgentId"),
    runId: requireId(proposal.runId, "preferenceProposal.runId"),
    createdAt: requireTimestamp(proposal.createdAt, "preferenceProposal.createdAt")
  };
}

/** A proposal has no effect until this explicit accept/reject decision is supplied. */
export function decidePreferenceProposal(untrustedProposal: unknown, untrustedDecision: unknown): DecidedPreferenceProposal {
  const proposal = parsePreferenceProposal(untrustedProposal);
  const decision = requireRecord(untrustedDecision, "preferenceDecision");
  const kind = requireString(decision.decision, "preferenceDecision.decision", 16);
  if (kind === "accept") {
    requireExactKeys(decision, ["decision", "acceptedBy", "decidedAt"], "preferenceDecision");
    return {
      status: "accepted",
      proposal,
      acceptedBy: requireId(decision.acceptedBy, "preferenceDecision.acceptedBy"),
      decidedAt: requireTimestamp(decision.decidedAt, "preferenceDecision.decidedAt")
    };
  }
  if (kind === "reject") {
    requireExactKeys(decision, ["decision", "rejectedBy", "decidedAt"], "preferenceDecision");
    return {
      status: "rejected",
      proposal,
      rejectedBy: requireId(decision.rejectedBy, "preferenceDecision.rejectedBy"),
      decidedAt: requireTimestamp(decision.decidedAt, "preferenceDecision.decidedAt")
    };
  }
  throw new AIContractValidationError("preferenceDecision.decision must be 'accept' or 'reject'.");
}
