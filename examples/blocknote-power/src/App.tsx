import { PowerDemoEditor } from "./PowerDemoEditor";

export function App() {
  return (
    <div className="page">
      <PowerDemoEditor />
      <footer className="footer">
        Outline · Search ⌘P · Commands ⌘K · No @blocknote/xl-* · MIT OpenEditor
      </footer>
    </div>
  );
}
