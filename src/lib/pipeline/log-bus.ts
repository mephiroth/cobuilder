const subs = new Map<string, Set<(chunk: string) => void>>();
const buffers = new Map<string, string[]>();
const MAX_BUFFER = 200;

export const logBus = {
  publish(ideaId: string, chunk: string) {
    const buf = buffers.get(ideaId) ?? [];
    buf.push(chunk);
    if (buf.length > MAX_BUFFER) buf.splice(0, buf.length - MAX_BUFFER);
    buffers.set(ideaId, buf);
    subs.get(ideaId)?.forEach((fn) => fn(chunk));
  },
  subscribe(ideaId: string, fn: (chunk: string) => void): () => void {
    if (!subs.has(ideaId)) subs.set(ideaId, new Set());
    subs.get(ideaId)!.add(fn);
    return () => subs.get(ideaId)?.delete(fn);
  },
  getBuffered(ideaId: string): string[] {
    return [...(buffers.get(ideaId) ?? [])];
  },
  clear(ideaId: string) {
    subs.delete(ideaId);
    buffers.delete(ideaId);
  },
};
