import type { JsonValue } from "@hello-ai-company/editor-core";
import {
  AIContractValidationError,
  cloneJsonValue,
  createValidationBudget,
  requireExactKeys,
  requireId,
  requireRecord,
  requireString,
  requireStringArray,
  requireText,
  requireTimestamp
} from "./validation.js";

export type AgentRunStatus =
  | "idle"
  | "queued"
  | "thinking"
  | "working"
  | "waiting_for_user"
  | "completed"
  | "failed"
  | "cancelled";

export type AgentDescriptor = Readonly<{
  id: string;
  name: string;
  description?: string;
  capabilities: readonly string[];
}>;

export type AgentRun = Readonly<{
  id: string;
  agentId: string;
  status: AgentRunStatus;
  createdAt: string;
  updatedAt: string;
}>;

/** Context is quoted source material and must never override the task instruction. */
export type AgentContextItem = Readonly<{
  id: string;
  kind: "document" | "comment" | "reference" | "search-result" | "other";
  text: string;
  trust: "untrusted";
  metadata?: Readonly<Record<string, JsonValue>>;
}>;

export type AgentRequest = Readonly<{
  runId: string;
  instruction: string;
  context: readonly AgentContextItem[];
  metadata?: Readonly<Record<string, JsonValue>>;
}>;

type AgentEventBase = Readonly<{
  runId: string;
  sequence: number;
  occurredAt: string;
}>;

export type AgentRunEvent =
  | (AgentEventBase & Readonly<{ type: "status"; status: AgentRunStatus; detail?: string }>)
  | (AgentEventBase & Readonly<{ type: "message"; message: string }>)
  | (AgentEventBase & Readonly<{ type: "suggestion"; payload: unknown }>)
  | (AgentEventBase & Readonly<{ type: "error"; code: string; message: string }>);

/**
 * Adapter contract only. The host owns execution, persistence, cancellation policy,
 * event validation, credentials, and user-visible approval.
 */
export interface AgentAdapter {
  readonly descriptor: AgentDescriptor;
  start(request: AgentRequest): AsyncIterable<AgentRunEvent>;
  cancel(runId: string): Promise<void>;
}

export function parseAgentDescriptor(value: unknown): AgentDescriptor {
  const descriptor = requireRecord(value, "agentDescriptor");
  requireExactKeys(descriptor, ["id", "name", "description", "capabilities"], "agentDescriptor");
  const capabilities = requireStringArray(descriptor.capabilities, "agentDescriptor.capabilities");
  if (new Set(capabilities).size !== capabilities.length) throw new AIContractValidationError("agentDescriptor.capabilities must be unique.");
  return {
    id: requireId(descriptor.id, "agentDescriptor.id"),
    name: requireString(descriptor.name, "agentDescriptor.name", 256),
    ...(descriptor.description === undefined ? {} : { description: requireText(descriptor.description, "agentDescriptor.description", 8_000) }),
    capabilities
  };
}

export function parseAgentRun(value: unknown): AgentRun {
  const run = requireRecord(value, "agentRun");
  requireExactKeys(run, ["id", "agentId", "status", "createdAt", "updatedAt"], "agentRun");
  return {
    id: requireId(run.id, "agentRun.id"),
    agentId: requireId(run.agentId, "agentRun.agentId"),
    status: parseStatus(run.status),
    createdAt: requireTimestamp(run.createdAt, "agentRun.createdAt"),
    updatedAt: requireTimestamp(run.updatedAt, "agentRun.updatedAt")
  };
}

/** Enforces that context stays explicitly labeled as untrusted source material. */
export function parseAgentRequest(value: unknown): AgentRequest {
  const budget = createValidationBudget();
  const request = requireRecord(value, "agentRequest");
  requireExactKeys(request, ["runId", "instruction", "context", "metadata"], "agentRequest");
  if (!Array.isArray(request.context) || request.context.length > 256) {
    throw new AIContractValidationError("agentRequest.context must contain at most 256 items.");
  }
  const context = request.context.map((itemValue, index): AgentContextItem => {
    const label = `agentRequest.context[${index}]`;
    const item = requireRecord(itemValue, label);
    requireExactKeys(item, ["id", "kind", "text", "trust", "metadata"], label);
    const kind = requireString(item.kind, `${label}.kind`, 32, budget);
    if (!isContextKind(kind)) throw new AIContractValidationError(`${label}.kind is unsupported.`);
    if (item.trust !== "untrusted") throw new AIContractValidationError(`${label}.trust must be 'untrusted'.`);
    return {
      id: requireId(item.id, `${label}.id`, budget),
      kind,
      text: requireText(item.text, `${label}.text`, undefined, budget),
      trust: "untrusted",
      ...(item.metadata === undefined ? {} : { metadata: parseJsonObject(item.metadata, `${label}.metadata`, budget) })
    };
  });
  return {
    runId: requireId(request.runId, "agentRequest.runId", budget),
    instruction: requireText(request.instruction, "agentRequest.instruction", 8_000, budget),
    context,
    ...(request.metadata === undefined ? {} : { metadata: parseJsonObject(request.metadata, "agentRequest.metadata", budget) })
  };
}

/** Validates the event envelope. Suggestion payloads remain unknown until parsed separately. */
export function parseAgentRunEvent(value: unknown): AgentRunEvent {
  const event = requireRecord(value, "agentRunEvent");
  const type = requireString(event.type, "agentRunEvent.type", 32);
  const base = {
    runId: requireId(event.runId, "agentRunEvent.runId"),
    sequence: requireSequence(event.sequence),
    occurredAt: requireTimestamp(event.occurredAt, "agentRunEvent.occurredAt")
  };
  switch (type) {
    case "status":
      requireExactKeys(event, ["type", "runId", "sequence", "occurredAt", "status", "detail"], "agentRunEvent");
      return { ...base, type, status: parseStatus(event.status), ...(event.detail === undefined ? {} : { detail: requireText(event.detail, "agentRunEvent.detail", 8_000) }) };
    case "message":
      requireExactKeys(event, ["type", "runId", "sequence", "occurredAt", "message"], "agentRunEvent");
      return { ...base, type, message: requireText(event.message, "agentRunEvent.message") };
    case "suggestion":
      requireExactKeys(event, ["type", "runId", "sequence", "occurredAt", "payload"], "agentRunEvent");
      if (!Object.prototype.hasOwnProperty.call(event, "payload")) throw new AIContractValidationError("agentRunEvent.payload is required.");
      return { ...base, type, payload: event.payload };
    case "error":
      requireExactKeys(event, ["type", "runId", "sequence", "occurredAt", "code", "message"], "agentRunEvent");
      return { ...base, type, code: requireString(event.code, "agentRunEvent.code", 128), message: requireText(event.message, "agentRunEvent.message", 8_000) };
    default:
      throw new AIContractValidationError("agentRunEvent.type is unsupported.");
  }
}

function parseStatus(value: unknown): AgentRunStatus {
  if (value === "idle" || value === "queued" || value === "thinking" || value === "working" || value === "waiting_for_user" || value === "completed" || value === "failed" || value === "cancelled") {
    return value;
  }
  throw new AIContractValidationError("agent status is unsupported.");
}

function requireSequence(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new AIContractValidationError("agentRunEvent.sequence must be a non-negative safe integer.");
  }
  return value;
}

function isContextKind(value: string): value is AgentContextItem["kind"] {
  return value === "document" || value === "comment" || value === "reference" || value === "search-result" || value === "other";
}

function parseJsonObject(value: unknown, label: string, budget: ReturnType<typeof createValidationBudget>): Readonly<Record<string, JsonValue>> {
  const cloned = cloneJsonValue(value, label, budget);
  if (cloned === null || Array.isArray(cloned) || typeof cloned !== "object") {
    throw new AIContractValidationError(`${label} must be a JSON object.`);
  }
  return cloned;
}
