/**
 * Minimal in-memory Firestore stand-in for API route tests.
 * Supports exactly the surface the routes under test use:
 * collection().where(==).limit().get(), collection().doc().get(),
 * doc().get()/set(merge). Anything else throws loudly so gaps surface
 * as test failures, not silent passes.
 */

type DocData = Record<string, unknown>;

export class FakeDocSnap {
  constructor(
    readonly id: string,
    private readonly data_: DocData | undefined,
  ) {}
  get exists() {
    return this.data_ !== undefined;
  }
  data() {
    return this.data_;
  }
}

class FakeQuerySnap {
  constructor(readonly docs: FakeDocSnap[]) {}
  get empty() {
    return this.docs.length === 0;
  }
}

export class FakeDocRef {
  constructor(
    private readonly store: Map<string, DocData>,
    private readonly path: string,
  ) {}
  async get() {
    const id = this.path.split("/").pop()!;
    return new FakeDocSnap(id, this.store.get(this.path));
  }
  async set(data: DocData, opts?: { merge?: boolean }) {
    const prev = opts?.merge ? (this.store.get(this.path) ?? {}) : {};
    this.store.set(this.path, { ...prev, ...data });
  }
  /** Create-only write: throws {code: 6} when the document already exists. */
  async create(data: DocData) {
    if (this.store.has(this.path)) {
      const err = new Error("already exists") as Error & { code: number };
      err.code = 6;
      throw err;
    }
    this.store.set(this.path, { ...data });
  }
  async update(data: DocData) {
    if (!this.store.has(this.path)) throw new Error("not found");
    this.store.set(this.path, { ...this.store.get(this.path)!, ...data });
  }
  async delete() {
    this.store.delete(this.path);
  }
}

class FakeQuery {
  private filters: Array<{ field: string; val: unknown }> = [];
  private limitN: number | null = null;
  constructor(
    private readonly store: Map<string, DocData>,
    private readonly prefix: string,
  ) {}
  where(field: string, op: string, val: unknown) {
    if (op !== "==") throw new Error(`FakeFirestore: unsupported op ${op}`);
    this.filters.push({ field, val });
    return this;
  }
  limit(n: number) {
    this.limitN = n;
    return this;
  }
  async get() {
    let entries = [...this.store.entries()].filter(([path]) => {
      if (!path.startsWith(this.prefix)) return false;
      // Direct children only: no extra "/" beyond the collection path.
      return !path.slice(this.prefix.length).includes("/");
    });
    for (const f of this.filters) {
      entries = entries.filter(([, d]) => d[f.field] === f.val);
    }
    if (this.limitN !== null) entries = entries.slice(0, this.limitN);
    return new FakeQuerySnap(
      entries.map(([path, d]) => new FakeDocSnap(path.split("/").pop()!, d)),
    );
  }
}

class FakeCollection {
  constructor(
    private readonly store: Map<string, DocData>,
    private readonly path: string,
  ) {}
  where(field: string, op: string, val: unknown) {
    return new FakeQuery(this.store, `${this.path}/`).where(field, op, val);
  }
  limit(n: number) {
    return new FakeQuery(this.store, `${this.path}/`).limit(n);
  }
  async get() {
    return new FakeQuery(this.store, `${this.path}/`).get();
  }
  doc(id: string) {
    return new FakeDocRef(this.store, `${this.path}/${id}`);
  }
}

export interface FakeTx {
  get: (ref: FakeDocRef) => Promise<FakeDocSnap>;
  set: (ref: FakeDocRef, data: DocData, opts?: { merge?: boolean }) => Promise<void>;
  update: (ref: FakeDocRef, data: DocData) => Promise<void>;
  delete: (ref: FakeDocRef) => Promise<void>;
}

export class FakeFirestore {
  private store = new Map<string, DocData>();

  collection(path: string) {
    return new FakeCollection(this.store, path);
  }
  doc(path: string) {
    return new FakeDocRef(this.store, path);
  }

  /** Runs fn immediately against the live store (tests are sequential). */
  async runTransaction<T>(fn: (tx: FakeTx) => Promise<T>): Promise<T> {
    const tx: FakeTx = {
      get: (ref) => ref.get(),
      set: (ref, data, opts) => ref.set(data, opts),
      update: (ref, data) => ref.update(data),
      delete: (ref) => ref.delete(),
    };
    return fn(tx);
  }

  batch() {
    const ops: Array<() => Promise<void>> = [];
    return {
      set: (ref: FakeDocRef, data: DocData, opts?: { merge?: boolean }) => {
        ops.push(() => ref.set(data, opts));
      },
      commit: async () => {
        for (const op of ops) await op();
      },
    };
  }

  /** Seed documents as full paths → data (e.g. "users/u1": {...}). */
  seed(docs: Record<string, DocData>) {
    for (const [path, data] of Object.entries(docs)) this.store.set(path, { ...data });
  }

  clear() {
    this.store.clear();
  }

  read(path: string): DocData | undefined {
    return this.store.get(path);
  }
}
