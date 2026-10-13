import { useEffect, useRef, useState } from "react";

export type NotesLegacyPresentationOptions = {
  /** Called only by an explicit preview action. Resolve from an already authorized host projection. */
  resolveMediaURL?(request: { blockId: string; sourceURL: string; kind: string }): string | undefined;
  /** Host routes through its existing guarded navigation; a reference is not a capability. */
  onOpenPage?(pageId: string): void | Promise<void>;
};
function safeLink(url: string): boolean { try { const parsed = new URL(url); return ["http:", "https:"].includes(parsed.protocol) && !parsed.username && !parsed.password; } catch { return false; } }
function safeMedia(url: string, kind: string): boolean { return safeLink(url) || /^blob:/i.test(url) || kind === "image" && /^data:image\/(png|jpeg|gif|webp);base64,/i.test(url); }
export function NotesLegacyLinkPresentation(props: { blockId: string; url?: string; pageId?: string; title: string; description: string; style: string; imageURL: string; imageAlt: string; options: NotesLegacyPresentationOptions }) {
  const navigation = useRef(false), mounted = useRef(true), [message, setMessage] = useState("");
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const label = props.title || props.url || props.pageId || "リンク";
  return <div className="oe-notes-legacy-link" data-presentation={props.style}>
    {props.style !== "text" && props.imageURL ? <NotesLegacyMediaPreview blockId={props.blockId} sourceURL={props.imageURL} kind="image" name={props.imageAlt || label} options={props.options} /> : null}
    <div>{props.pageId ? <button type="button" disabled={!props.options.onOpenPage} onClick={() => { if (navigation.current) return; navigation.current = true; void Promise.resolve().then(() => props.options.onOpenPage?.(props.pageId!)).catch(() => { if (mounted.current) setMessage("参照先を開けませんでした"); }).finally(() => { navigation.current = false; }); }}>{label}</button> : props.url && safeLink(props.url) ? <a href={props.url} target="_blank" rel="noopener noreferrer">{label}</a> : <strong>{label}</strong>}
      {props.style !== "text" && props.description ? <p>{props.description}</p> : null}{props.style !== "text" && props.url ? <small>{safeLink(props.url) ? new URL(props.url).hostname : "元のURLを保持しています"}</small> : null}
    </div>{message ? <p role="status">{message}</p> : null}
  </div>;
}
export function NotesLegacyMediaPreview(props: { blockId: string; sourceURL: string; kind: string; name: string; options: NotesLegacyPresentationOptions }) {
  const [resolved, setResolved] = useState<string>(), [message, setMessage] = useState("");
  useEffect(() => { setResolved(undefined); setMessage(""); }, [props.blockId, props.sourceURL, props.kind, props.options.resolveMediaURL]);
  const preview = () => {
    try { const url = props.options.resolveMediaURL?.({ blockId: props.blockId, sourceURL: props.sourceURL, kind: props.kind }); if (!url || !safeMedia(url, props.kind)) throw new Error("Unavailable media"); setResolved(url); }
    catch { setMessage("プレビューを取得できませんでした。元の参照は保持しています"); }
  };
  return <div className="oe-notes-legacy-media">{resolved ? <>
    {props.kind === "image" ? <img src={resolved} alt={props.name} /> : props.kind === "video" ? <video src={resolved} controls preload="metadata" /> : props.kind === "audio" ? <audio src={resolved} controls preload="metadata" /> : props.kind === "pdf" ? <iframe title={props.name} src={resolved} sandbox="" /> : <a href={resolved} target="_blank" rel="noopener noreferrer">{props.name || "ファイルを開く"}</a>}
    <button type="button" onClick={() => setResolved(undefined)}>プレビューを閉じる</button>
  </> : <button type="button" disabled={!props.options.resolveMediaURL} onClick={preview}>プレビューを表示</button>}{message ? <p role="status">{message}</p> : null}</div>;
}
