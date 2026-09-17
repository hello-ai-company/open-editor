import { useRef } from "react";
import { PowerDemoEditor } from "./PowerDemoEditor";

const QUICK_START = `npm install @hello-ai-company/editor-core
# workspace: @hello-ai-company/editor-blocknote@0.1.0 (unpublished)
npm install @blocknote/core@^0.54.2 @blocknote/react@^0.54.2 @blocknote/mantine react react-dom

# See packages/blocknote/README.md for the minimal React snippet.
`;

export function App() {
  const editorRef = useRef<HTMLDivElement | null>(null);

  return (
    <div className="page">
      <section className="hero">
        <div className="hero__veil" aria-hidden="true" />
        <div className="hero__content">
          <p className="hero__brand">OpenEditor</p>
          <h1 className="hero__headline">BlockNote power foundation</h1>
          <p className="hero__lede">
            Portable documents, shared commands, and host seams on top of BlockNote — without XL
            packages or owned persistence.
          </p>
          <div className="hero__actions">
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => editorRef.current?.scrollIntoView({ behavior: "smooth" })}
            >
              Open editor
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={async () => {
                await navigator.clipboard.writeText(QUICK_START);
              }}
            >
              Copy Quick Start
            </button>
          </div>
        </div>
      </section>

      <div ref={editorRef}>
        <PowerDemoEditor />
      </div>

      <footer className="footer">
        No @blocknote/xl-* · MPL BlockNote peers · MIT OpenEditor · Collab off by default
      </footer>
    </div>
  );
}
