import type {
  AssetProvider,
  CommentsProvider,
  EditorAsset,
  EditorComment,
  EditorUploadFile
} from "@hello-ai-company/editor-core";

export type PowerSeams = {
  files?: Pick<AssetProvider, "upload" | "insertCloud">;
  comments?: CommentsProvider;
  collab?: {
    enabled: boolean;
    /** opaque host handle; power layer does not interpret */
    awarenessLabel?: string;
  };
};

export function createNoopCollabSeam(): NonNullable<PowerSeams["collab"]> {
  return {
    enabled: false,
    awarenessLabel: "Collab: off (host wires Yjs)"
  };
}

export function createMemoryCommentsSeam(): CommentsProvider {
  const items: EditorComment[] = [];

  return {
    async list(_documentId: string) {
      return [...items];
    },
    async add(_documentId: string, blockId: string, text: string) {
      const comment: EditorComment = {
        id: `c-${Date.now()}`,
        blockId,
        text,
        createdAt: new Date().toISOString()
      };
      items.push(comment);
      return comment;
    },
    async update(
      _documentId: string,
      commentId: string,
      update: { text?: string; resolved?: boolean }
    ) {
      const index = items.findIndex((item) => item.id === commentId);
      if (index < 0) return;
      const current = items[index];
      if (!current) return;
      const next: EditorComment = {
        ...current,
        ...(update.text !== undefined ? { text: update.text } : {}),
        ...(update.resolved !== undefined ? { resolved: update.resolved } : {})
      };
      items[index] = next;
      return next;
    },
    async delete(_documentId: string, commentId: string) {
      const index = items.findIndex((item) => item.id === commentId);
      if (index >= 0) items.splice(index, 1);
    }
  };
}

export function createMemoryFileSeam(): NonNullable<PowerSeams["files"]> {
  return {
    async upload(file: EditorUploadFile) {
      const name = file.name;
      const url = `memory://${name}`;
      const asset: EditorAsset = {
        url,
        name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        kind: "file"
      };
      return asset;
    },
    insertCloud(_asset: EditorAsset) {
      // Host would insert the cloud asset reference into the document.
    }
  };
}
