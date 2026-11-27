type Listener = () => void;

/**
 * Tells every open canvas of a project that its datasets changed. It lives in
 * memory, which is enough while one server process serves everyone.
 */
export class ProjectEvents {
  private readonly listeners = new Map<string, Set<Listener>>();

  subscribe(projectId: string, listener: Listener): () => void {
    let set = this.listeners.get(projectId);
    if (set === undefined) {
      set = new Set();
      this.listeners.set(projectId, set);
    }
    set.add(listener);
    return () => {
      const current = this.listeners.get(projectId);
      if (current === undefined) {
        return;
      }
      current.delete(listener);
      if (current.size === 0) {
        this.listeners.delete(projectId);
      }
    };
  }

  publish(projectId: string): void {
    for (const listener of this.listeners.get(projectId) ?? []) {
      listener();
    }
  }

  listenerCount(projectId: string): number {
    return this.listeners.get(projectId)?.size ?? 0;
  }
}
