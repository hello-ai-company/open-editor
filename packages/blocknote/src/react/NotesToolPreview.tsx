/** Small static examples: no network requests, embedded scripts or editor instance. */
export function NotesToolPreview({ kind }: { kind: string }) {
  let sample;
  if (["tableInsert", "collection"].includes(kind)) sample = <div className="oe-notes-example-table">{["Name", "Status", "Design", "Done", "Review", "Next"].map((text, i) => <span key={i}>{text}</span>)}</div>;
  else if (["columns", "gallery", "kanban"].includes(kind)) sample = <div className="oe-notes-example-columns" data-kind={kind}>{["Ideas", "In progress", "Ready"].slice(0, kind === "columns" ? 2 : 3).map(text => <div key={text}><strong>{text}</strong><i /><i /><i /></div>)}</div>;
  else if (["code", "htmlEmbed"].includes(kind)) sample = <pre>{kind === "code" ? 'const idea = "Hello";\nconsole.log(idea);' : '<section>\n  <h1>Hello</h1>\n</section>'}</pre>;
  else if (kind === "equation") sample = <span className="oe-notes-example-equation">E = mc²</span>;
  else if (["mermaid", "whiteboard", "syncedBlock"].includes(kind)) sample = <div className="oe-notes-example-diagram"><span>{kind === "syncedBlock" ? "Shared" : "Idea"}</span><b>→</b><span>{kind === "whiteboard" ? "Sketch" : "Plan"}</span></div>;
  else if (["image", "unsplash", "video"].includes(kind)) sample = <div className="oe-notes-example-image"><svg viewBox="0 0 200 80" aria-hidden="true"><circle cx="152" cy="20" r="12" /><path d="M0 80 65 18 108 67 144 39 200 80Z" /></svg>{kind === "video" ? <b>▶</b> : null}</div>;
  else if (kind === "audio") sample = <div className="oe-notes-example-audio"><span>▶</span>{[12, 24, 38, 26, 16, 34, 44, 22, 30, 14].map((height, i) => <i key={i} style={{ height }} />)}<small>0:24</small></div>;
  else if (["attachment", "pdf"].includes(kind)) sample = <div className="oe-notes-example-card"><b>{kind === "pdf" ? "PDF" : "FILE"}</b><span>Project brief<small>240 KB · Document</small></span></div>;
  else if (["page", "card", "link"].includes(kind)) sample = <div className="oe-notes-example-card"><b>↗</b><span style={kind === "link" ? { textDecoration: "underline" } : undefined}>Project notes<small>{kind === "page" ? "Child page" : "Related information"}</small></span></div>;
  else if (["divider", "pageBreak"].includes(kind)) sample = <div className="oe-notes-example-lines"><i /><hr style={kind === "pageBreak" ? { borderStyle: "dashed" } : undefined} /><i /></div>;
  else if (["bullet", "numbered", "checklist"].includes(kind)) sample = <div className="oe-notes-example-list">{["Capture an idea", "Plan the next step", "Share the result"].map((text, i) => <span key={text}>{kind === "numbered" ? `${i + 1}.` : kind === "checklist" ? i === 0 ? "☑" : "☐" : "•"} {text}</span>)}</div>;
  else sample = <div className="oe-notes-example-text" data-kind={kind}><strong>{kind === "heading" ? "A clear heading" : kind === "quote" ? "“A thought worth keeping.”" : kind === "callout" ? "💡 An idea to remember" : "Your next idea"}</strong><p>Write, shape and share your thoughts.</p><i /></div>;
  return <div className="oe-notes-tool-example" data-example={kind} aria-hidden="true">{sample}</div>;
}
