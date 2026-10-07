import { Component, lazy, Suspense, useRef, useState, type ReactNode } from "react";
import { LocalDocumentWorkspace } from "./LocalDocumentWorkspace";
import { createLocalPersonalAiHost } from "./localPersonalAi";
const PersonalContextWorkbench = lazy(() => import("./PersonalContextWorkbench").then(module => ({ default: module.PersonalContextWorkbench })));

const NoteOrganizationWorkbench = lazy(() => import("./NoteOrganizationWorkbench").then(module => ({ default: module.NoteOrganizationWorkbench })));
const NotesWorkspaceWorkbench = lazy(() => import("./NotesWorkspaceWorkbench").then(module => ({ default: module.NotesWorkspaceWorkbench })));

class ContextBoundary extends Component<{ children: ReactNode; onBack: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <section className="demo-feedback" role="alert"><p>Local context review could not open. Your Document is kept.</p><button type="button" className="chip" onClick={this.props.onBack}>Return to Document</button></section> : this.props.children;
  }
}
export function App() {
  const [host] = useState(() => new URL(location.href).searchParams.get("host") === "personal-ai-local" ? createLocalPersonalAiHost() : undefined);
  const [contextOpen, setContextOpen] = useState(false);
  const [contextVisited, setContextVisited] = useState(false);
  const editorScroll = useRef(0);
  const back = () => {
    setContextOpen(false);
    requestAnimationFrame(() => { window.scrollTo(0, editorScroll.current); document.getElementById("demo-main")?.focus({ preventScroll: true }); });
  };
  if (new URL(location.href).searchParams.get("notes") === "synthetic") return <Suspense fallback={<p role="status">Loading synthetic Notes workspace…</p>}><NotesWorkspaceWorkbench /></Suspense>;
  if (new URL(location.href).searchParams.get("organize") === "synthetic") return <Suspense fallback={<p role="status">Loading synthetic note organization…</p>}><NoteOrganizationWorkbench /></Suspense>;
  return <>
    <div className="local-document-controls"><a href="?organize=synthetic" target="_blank" rel="noopener">自由メモ整理の合成デモを開く</a></div>
    <div hidden={contextOpen}><LocalDocumentWorkspace host={host} store={host?.store} active={!contextOpen} onOpenPersonalContext={() => { editorScroll.current = window.scrollY; setContextVisited(true); setContextOpen(true); window.scrollTo(0, 0); }} /></div>
    {contextVisited ? <div hidden={!contextOpen}><ContextBoundary onBack={back}><Suspense fallback={<p role="status">Loading local context review…</p>}><PersonalContextWorkbench active={contextOpen} onBack={back} /></Suspense></ContextBoundary></div> : null}
  </>;
}
