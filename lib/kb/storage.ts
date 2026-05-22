// Native IndexedDB wrapper for the project knowledge base.
//   - `docs` store mirrors the doc list we also keep in localStorage; the
//     IDB copy lets us survive localStorage eviction and is the source of
//     truth for chunk-cascade deletes.
//   - `chunks` store holds the embeddings (as raw Float32Array bytes for
//     compactness — ~6 KB per chunk vs ~16 KB if we stored JSON arrays).
//   - All queries are scoped by projectId so chunks from one project never
//     leak into another's retrieval.
//
// Why no `idb` library: the surface is small and the native API is fine
// once wrapped in a few Promise helpers. Saves ~10 KB on the client bundle.

import type { KnowledgeBaseChunk, KnowledgeBaseDoc } from "@/lib/types";

const DB_NAME = "dtdm-knowledge-base";
const DB_VERSION = 2;
const DOCS_STORE = "docs";
const CHUNKS_STORE = "chunks";
// Pass 5 — cross-project library. Stores docs/chunks scoped to a synthetic
// "library" projectId so the existing query paths re-use unchanged.
const LIBRARY_DOCS_STORE = "library_docs";
const LIBRARY_CHUNKS_STORE = "library_chunks";

export const LIBRARY_PROJECT_ID = "__library__";

const EMBEDDING_DIMS = 1536;
const EMBEDDING_BYTES = EMBEDDING_DIMS * 4; // Float32 → 4 bytes per dim

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB is not available"));
  }
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DOCS_STORE)) {
        const docs = db.createObjectStore(DOCS_STORE, { keyPath: "id" });
        docs.createIndex("projectId", "projectId", { unique: false });
      }
      if (!db.objectStoreNames.contains(CHUNKS_STORE)) {
        const chunks = db.createObjectStore(CHUNKS_STORE, { keyPath: "id" });
        chunks.createIndex("projectId", "projectId", { unique: false });
        chunks.createIndex("docId", "docId", { unique: false });
      }
      // v2: cross-project library.
      if (!db.objectStoreNames.contains(LIBRARY_DOCS_STORE)) {
        const lDocs = db.createObjectStore(LIBRARY_DOCS_STORE, {
          keyPath: "id",
        });
        lDocs.createIndex("addedAt", "addedAt", { unique: false });
      }
      if (!db.objectStoreNames.contains(LIBRARY_CHUNKS_STORE)) {
        const lChunks = db.createObjectStore(LIBRARY_CHUNKS_STORE, {
          keyPath: "id",
        });
        lChunks.createIndex("libraryDocId", "libraryDocId", { unique: false });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IDB open failed"));
  });

  // Reset the cached promise on close so the next call reopens.
  dbPromise.then((db) => {
    db.onclose = () => {
      dbPromise = null;
    };
  });

  return dbPromise;
}

function tx<T>(
  storeNames: string | string[],
  mode: IDBTransactionMode,
  work: (
    stores: IDBObjectStore | Record<string, IDBObjectStore>,
  ) => Promise<T> | T,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(storeNames, mode);
        const stores =
          typeof storeNames === "string"
            ? t.objectStore(storeNames)
            : Object.fromEntries(
                (storeNames as string[]).map((n) => [n, t.objectStore(n)]),
              );

        let result: T;
        let cleared = false;

        const run = async () => {
          try {
            result = await work(stores);
            cleared = true;
          } catch (err) {
            t.abort();
            reject(err);
          }
        };

        t.oncomplete = () => {
          if (cleared) resolve(result);
        };
        t.onabort = () =>
          reject(t.error ?? new Error("IDB transaction aborted"));
        t.onerror = () => reject(t.error ?? new Error("IDB transaction error"));

        void run();
      }),
  );
}

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error ?? new Error("IDB request failed"));
  });
}

// ── Float32Array <-> ArrayBuffer helpers ──────────────────────────────────

function embeddingToBytes(embedding: Float32Array): ArrayBuffer {
  if (embedding.length !== EMBEDDING_DIMS) {
    throw new Error(
      `Embedding has ${embedding.length} dims, expected ${EMBEDDING_DIMS}`,
    );
  }
  // Always clone into a fresh buffer so we don't accidentally store a view
  // into a larger backing buffer.
  const out = new ArrayBuffer(EMBEDDING_BYTES);
  new Float32Array(out).set(embedding);
  return out;
}

function bytesToEmbedding(bytes: ArrayBuffer): Float32Array {
  return new Float32Array(bytes);
}

// ── Doc store ─────────────────────────────────────────────────────────────

export async function putDoc(doc: KnowledgeBaseDoc): Promise<void> {
  await tx(DOCS_STORE, "readwrite", async (store) => {
    await req((store as IDBObjectStore).put(doc));
  });
}

export async function getDoc(id: string): Promise<KnowledgeBaseDoc | null> {
  return tx(DOCS_STORE, "readonly", async (store) => {
    const result = await req(
      (store as IDBObjectStore).get(id) as IDBRequest<
        KnowledgeBaseDoc | undefined
      >,
    );
    return result ?? null;
  });
}

export async function getDocs(projectId: string): Promise<KnowledgeBaseDoc[]> {
  return tx(DOCS_STORE, "readonly", async (store) => {
    const index = (store as IDBObjectStore).index("projectId");
    const results = await req(
      index.getAll(projectId) as IDBRequest<KnowledgeBaseDoc[]>,
    );
    return results;
  });
}

export async function deleteDoc(docId: string): Promise<void> {
  await tx([DOCS_STORE, CHUNKS_STORE], "readwrite", async (stores) => {
    const map = stores as Record<string, IDBObjectStore>;
    const docs = map[DOCS_STORE];
    const chunks = map[CHUNKS_STORE];

    await req(docs.delete(docId));

    const chunkIndex = chunks.index("docId");
    const chunkIds = await req(
      chunkIndex.getAllKeys(docId) as IDBRequest<IDBValidKey[]>,
    );
    for (const cid of chunkIds) {
      await req(chunks.delete(cid));
    }
  });
}

// ── Chunk store ───────────────────────────────────────────────────────────

export type ChunkWithEmbedding = KnowledgeBaseChunk & {
  embedding: Float32Array;
};

// Persisted shape — embedding stored as ArrayBuffer for compactness.
type PersistedChunk = KnowledgeBaseChunk & { embedding: ArrayBuffer };

export async function putChunks(chunks: ChunkWithEmbedding[]): Promise<void> {
  if (chunks.length === 0) return;
  await tx(CHUNKS_STORE, "readwrite", async (store) => {
    for (const c of chunks) {
      const persisted: PersistedChunk = {
        ...c,
        embedding: embeddingToBytes(c.embedding),
      };
      await req((store as IDBObjectStore).put(persisted));
    }
  });
}

export async function getProjectChunksWithEmbeddings(
  projectId: string,
): Promise<ChunkWithEmbedding[]> {
  return tx(CHUNKS_STORE, "readonly", async (store) => {
    const index = (store as IDBObjectStore).index("projectId");
    const persisted = await req(
      index.getAll(projectId) as IDBRequest<PersistedChunk[]>,
    );
    return persisted.map((p) => ({
      ...p,
      embedding: bytesToEmbedding(p.embedding),
    }));
  });
}

export async function getProjectChunks(
  projectId: string,
): Promise<KnowledgeBaseChunk[]> {
  const withEmb = await getProjectChunksWithEmbeddings(projectId);
  return withEmb.map(({ embedding: _embedding, ...rest }) => rest);
}

export async function getChunksByIds(
  ids: string[],
): Promise<KnowledgeBaseChunk[]> {
  if (ids.length === 0) return [];
  return tx(CHUNKS_STORE, "readonly", async (store) => {
    const out: KnowledgeBaseChunk[] = [];
    for (const id of ids) {
      const p = await req(
        (store as IDBObjectStore).get(id) as IDBRequest<
          PersistedChunk | undefined
        >,
      );
      if (p) {
        const { embedding: _embedding, ...rest } = p;
        out.push(rest);
      }
    }
    return out;
  });
}

export async function deleteProjectChunks(projectId: string): Promise<void> {
  await tx([DOCS_STORE, CHUNKS_STORE], "readwrite", async (stores) => {
    const map = stores as Record<string, IDBObjectStore>;
    const docs = map[DOCS_STORE];
    const chunks = map[CHUNKS_STORE];

    const docIndex = docs.index("projectId");
    const docIds = await req(
      docIndex.getAllKeys(projectId) as IDBRequest<IDBValidKey[]>,
    );
    for (const id of docIds) {
      await req(docs.delete(id));
    }

    const chunkIndex = chunks.index("projectId");
    const chunkIds = await req(
      chunkIndex.getAllKeys(projectId) as IDBRequest<IDBValidKey[]>,
    );
    for (const id of chunkIds) {
      await req(chunks.delete(id));
    }
  });
}

// ── Quota / usage ─────────────────────────────────────────────────────────

export type StorageUsage = {
  quotaBytes: number;
  usageBytes: number;
  freeBytes: number;
  freeMb: number;
};

export async function storageUsage(): Promise<StorageUsage | null> {
  if (
    typeof navigator === "undefined" ||
    !navigator.storage ||
    typeof navigator.storage.estimate !== "function"
  ) {
    return null;
  }
  const est = await navigator.storage.estimate();
  const quota = est.quota ?? 0;
  const usage = est.usage ?? 0;
  const free = Math.max(0, quota - usage);
  return {
    quotaBytes: quota,
    usageBytes: usage,
    freeBytes: free,
    freeMb: free / (1024 * 1024),
  };
}

export const STORAGE_LOW_THRESHOLD_MB = 10;

// ── Cross-project library ─────────────────────────────────────────────────

export type LibraryDoc = Omit<KnowledgeBaseDoc, "projectId"> & {
  // Library docs are user-curated — usually promoted from a project.
  sourceProjectId?: string;
};

type PersistedLibraryChunk = Omit<KnowledgeBaseChunk, "projectId"> & {
  libraryDocId: string;
  embedding: ArrayBuffer;
};

export type LibraryChunkWithEmbedding = Omit<
  KnowledgeBaseChunk,
  "projectId"
> & {
  libraryDocId: string;
  embedding: Float32Array;
};

export async function putLibraryDoc(doc: LibraryDoc): Promise<void> {
  await tx(LIBRARY_DOCS_STORE, "readwrite", async (store) => {
    await req((store as IDBObjectStore).put(doc));
  });
}

export async function listLibraryDocs(): Promise<LibraryDoc[]> {
  return tx(LIBRARY_DOCS_STORE, "readonly", async (store) => {
    const results = await req(
      (store as IDBObjectStore).getAll() as IDBRequest<LibraryDoc[]>,
    );
    return results.sort((a, b) => (a.addedAt > b.addedAt ? -1 : 1));
  });
}

export async function deleteLibraryDoc(docId: string): Promise<void> {
  await tx(
    [LIBRARY_DOCS_STORE, LIBRARY_CHUNKS_STORE],
    "readwrite",
    async (stores) => {
      const map = stores as Record<string, IDBObjectStore>;
      await req(map[LIBRARY_DOCS_STORE].delete(docId));
      const chunkIndex = map[LIBRARY_CHUNKS_STORE].index("libraryDocId");
      const chunkIds = await req(
        chunkIndex.getAllKeys(docId) as IDBRequest<IDBValidKey[]>,
      );
      for (const cid of chunkIds) {
        await req(map[LIBRARY_CHUNKS_STORE].delete(cid));
      }
    },
  );
}

export async function putLibraryChunks(
  chunks: LibraryChunkWithEmbedding[],
): Promise<void> {
  if (chunks.length === 0) return;
  await tx(LIBRARY_CHUNKS_STORE, "readwrite", async (store) => {
    for (const c of chunks) {
      const persisted: PersistedLibraryChunk = {
        ...c,
        embedding: embeddingToBytes(c.embedding),
      };
      await req((store as IDBObjectStore).put(persisted));
    }
  });
}

export async function getLibraryChunksWithEmbeddings(
  libraryDocId: string,
): Promise<LibraryChunkWithEmbedding[]> {
  return tx(LIBRARY_CHUNKS_STORE, "readonly", async (store) => {
    const idx = (store as IDBObjectStore).index("libraryDocId");
    const persisted = await req(
      idx.getAll(libraryDocId) as IDBRequest<PersistedLibraryChunk[]>,
    );
    return persisted.map((p) => ({
      ...p,
      embedding: bytesToEmbedding(p.embedding),
    }));
  });
}

// Promote a project doc → library. Copies the doc metadata + chunks
// (including embeddings) so the library copy is independent of the source.
export async function promoteToLibrary(
  doc: KnowledgeBaseDoc,
): Promise<LibraryDoc> {
  const { projectId: _projectId, ...rest } = doc;
  const libraryDoc: LibraryDoc = {
    ...rest,
    id: `lib-${doc.id}-${Date.now().toString(36)}`,
    sourceProjectId: doc.projectId,
    addedAt: new Date().toISOString(),
  };
  await putLibraryDoc(libraryDoc);

  const projectChunks = await getProjectChunksWithEmbeddings(doc.projectId);
  const matching = projectChunks.filter((c) => c.docId === doc.id);
  const libraryChunks: LibraryChunkWithEmbedding[] = matching.map((c, i) => ({
    id: `${libraryDoc.id}-c${i}`,
    libraryDocId: libraryDoc.id,
    docId: libraryDoc.id,
    text: c.text,
    page: c.page,
    sheet: c.sheet,
    rangeRef: c.rangeRef,
    chunkIndex: c.chunkIndex,
    embedding: c.embedding,
  }));
  await putLibraryChunks(libraryChunks);
  return libraryDoc;
}

// Import a library doc into a specific project. Creates fresh chunk IDs
// scoped to the project so retrieval continues to work via the per-project
// chunks index.
export async function importLibraryDocToProject(
  libraryDoc: LibraryDoc,
  projectId: string,
): Promise<KnowledgeBaseDoc> {
  const newDocId = `local-${libraryDoc.id}-${Date.now().toString(36)}`;
  const projectDoc: KnowledgeBaseDoc = {
    ...libraryDoc,
    id: newDocId,
    projectId,
    addedAt: new Date().toISOString(),
    source: "upload",
  };
  await putDoc(projectDoc);

  const libraryChunks = await getLibraryChunksWithEmbeddings(libraryDoc.id);
  const projectChunks: ChunkWithEmbedding[] = libraryChunks.map((c, i) => ({
    id: `${newDocId}-c${i}`,
    projectId,
    docId: newDocId,
    text: c.text,
    page: c.page,
    sheet: c.sheet,
    rangeRef: c.rangeRef,
    chunkIndex: c.chunkIndex,
    embedding: c.embedding,
  }));
  await putChunks(projectChunks);
  return projectDoc;
}
