# Notes .24 — preserve the visible Code selection during copy

Local review candidate based on immutable .23 /508cd2bc4eb14a8559e6f1eff728ee75a4d18f5c. No publication, PA installation, canonical schema changes or DB37 adoption.

Fast native Shift+ArrowLeft selection followed by Cmd+C can leave DOM selection ahead of BlockNote/ProseMirror state. The existing serializer writes the stale shorter range, dropping a Code prefix. A real PA Split probe confirmed a full DOM selection, truncated `text/plain`, and the same truncated string pasted into an actual textarea. This is not a clipboard-readback-only discrepancy. Slower key operations pass; the regression covers the original fast path without a stabilization delay.

The Document feature and optional Code feature now install an instance-scoped Code copy selection guard. Immediately before native copy serialization, it maps both DOM endpoints through public EditorView position APIs, checks that the range belongs to one current Code inline surface and matches canonical text, and synchronizes only a differing TextSelection. BlockNote still writes all three clipboard formats. No clipboard override, permissions, delay, global selection state or source mutation is added.

Native widget focus, IME composition, another editor's range, noneditable islands, transient/mismatching DOM, and non-Code selections retain existing handling. The two feature paths share one factory identity and dedupe to one guard per editor. The PA HTML fastest-pointer patch is independent and stays with the PA host owner.
