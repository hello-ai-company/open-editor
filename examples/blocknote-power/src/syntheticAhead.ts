import { parseAgentRequest, type AgentAdapter } from "@hello-ai-company/editor-ai";
import type { EditorDocument } from "@hello-ai-company/editor-core";

/** Local scaffolding only. No research, network, model, account or persistent grant. */
export function createSyntheticAheadAdapter(): AgentAdapter {
  const running = new Map<string, { finish: () => void; timer: ReturnType<typeof setTimeout>; cancelled: boolean }>();
  return {
    descriptor: { id: "openeditor-synthetic-ahead", name: "ローカル動作確認", capabilities: ["synthetic-proposals"] },
    async *start(raw) {
      const request = parseAgentRequest(raw);
      const document: EditorDocument = JSON.parse(request.context[0]!.text);
      const phase = request.metadata?.phase;
      let finish!: () => void;
      const wait = new Promise<void>(resolve => { finish = resolve; });
      const run = { finish, timer: setTimeout(finish, 650), cancelled: false };
      running.set(request.runId, run);
      try {
        yield { runId: request.runId, sequence: 0, occurredAt: new Date().toISOString(), type: "status", status: "working" };
        await wait;
        if (run.cancelled) return;
        const goal = request.instruction;
        const direction = typeof request.metadata?.direction === "string" ? request.metadata.direction : "";
        const copy = phase === "outline"
          ? [`「${goal}」の構成案：伝えたいこと、背景、次の行動の順にまとめる。`, "各見出しの下に、読み手が知りたいことを一つずつ置く。"]
          : phase === "research"
            ? [`「${goal}」で確かめること：根拠となる一次資料、日付、前提条件。`, "これは調査項目の合成例です。実際の検索や出典の確認は行っていません。"]
            : /不気味|怖|eerie/i.test(direction)
              ? ["廊下の奥で、消したはずの明かりが一つだけ灯っていた。誰もいない部屋から、椅子を引く音がした。", "扉の隙間の影は動かなかった。それでも、こちらを見ていることだけは分かった。"]
              : [`「${goal}」の次の段落を準備するため、まず読み手と結論を一文で示す。`, "ここに自分の具体例を加え、確かめた事実と意見を分けて書く。"];
        yield { runId: request.runId, sequence: 1, occurredAt: new Date().toISOString(), type: "suggestion", payload: {
          schemaVersion: 1, id: `ahead-${crypto.randomUUID()}`,
          title: phase === "outline" ? "構成を準備" : phase === "research" ? "確かめる項目を準備" : "次の段落を準備",
          summary: "合成例です。使う段落だけ選び、自分の言葉に編集してください。",
          baseDocument: document,
          changes: copy.map(text => ({ op: "insert", block: { id: crypto.randomUUID(), type: "paragraph",
            props: { backgroundColor: "default", textColor: "default", textAlignment: "left" },
            content: [{ type: "text", text, styles: {} }] } }))
        } };
        yield { runId: request.runId, sequence: 2, occurredAt: new Date().toISOString(), type: "status", status: "completed" };
      } finally { clearTimeout(run.timer); running.delete(request.runId); }
    },
    async cancel(id) {
      const run = running.get(id);
      if (run) { run.cancelled = true; clearTimeout(run.timer); run.finish(); }
    }
  };
}
