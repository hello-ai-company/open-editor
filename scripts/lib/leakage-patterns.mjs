export const leakagePatterns = [
  { name: "personal-ai", pattern: /personal-ai/i },
  { name: "Personal AI", pattern: /Personal AI/ },
  { name: "Secretary", pattern: /\bSecretary\b/ },
  { name: "AgentTask", pattern: /\bAgentTask\b/ },
  { name: "supabase", pattern: /supabase/i },
  { name: "/api/v1", pattern: /\/api\/v1\b/ },
  { name: "__PAI_", pattern: /__PAI_/ },
  { name: "WKWebView", pattern: /WKWebView/ },
  { name: "openEmployees", pattern: /openEmployees/ },
  { name: "openAIEmployees", pattern: /openAIEmployees/ },
  { name: "openStyleGallery", pattern: /openStyleGallery/ },
  { name: "setDocumentStyle", pattern: /setDocumentStyle/ },
  { name: "LIGHTSAIL", pattern: /LIGHTSAIL/ },
  { name: "SUPABASE_JWT_SECRET", pattern: /SUPABASE_JWT_SECRET/ },
  { name: "github_pat_", pattern: /github_pat_/ },
  { name: "ghp_", pattern: /ghp_[A-Za-z0-9]{20,}/ },
  { name: "NoteRichEditor", pattern: /NoteRichEditor/ },
  { name: "noteBlockSync", pattern: /noteBlockSync/ },
  { name: "editorAdapters", pattern: /editorAdapters/ },
  { name: "@blocknote", pattern: /@blocknote/ },
  { name: "react import", pattern: /from ["']react["']/ }
];

const privatePathPattern = /(?:^|["'\s])(?:\/Users\/|\/home\/|\/workspace\/|[A-Za-z]:\\)/;

export function findLeakageHits(text) {
  return leakagePatterns.filter(({ pattern }) => pattern.test(text)).map(({ name }) => name);
}

export function hasPrivateAbsolutePath(text) {
  return privatePathPattern.test(text);
}
