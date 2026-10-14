import { clone, validateProject, type Project } from "./model";
export class Store {
  project: Project;
  past: Project[] = [];
  future: Project[] = [];
  listeners = new Set<() => void>();
  private transaction?: Project;
  constructor(p: Project) {
    this.project = p;
  }
  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  notify() {
    for (const f of this.listeners) f();
  }
  begin() {
    this.transaction ??= clone(this.project);
  }
  commit() {
    if (!this.transaction) return;
    if (JSON.stringify(this.transaction) !== JSON.stringify(this.project)) {
      this.past.push(this.transaction);
      if (this.past.length > 40) this.past.shift();
      this.future = [];
    }
    this.transaction = undefined;
    this.notify();
  }
  edit(fn: (p: Project) => void) {
    this.begin();
    try {
      fn(this.project);
      this.commit();
    } catch (e) {
      this.project = this.transaction!;
      this.transaction = undefined;
      throw e;
    }
  }
  undo() {
    if (!this.past.length) return;
    this.future.push(clone(this.project));
    this.project = this.past.pop()!;
    this.transaction = undefined;
    this.notify();
  }
  redo() {
    if (!this.future.length) return;
    this.past.push(clone(this.project));
    this.project = this.future.pop()!;
    this.transaction = undefined;
    this.notify();
  }
  replace(p: Project) {
    this.edit(() => {
      this.project = clone(p);
    });
  }
}
const DB = "xpin-studio-v3";
async function db() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore("projects");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
export async function autosave(p: Project) {
  const d = await db();
  await new Promise<void>((resolve, reject) => {
    const tx = d.transaction("projects", "readwrite");
    tx.objectStore("projects").put(clone(p), "current");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  d.close();
}
export async function restore() {
  const d = await db();
  const p = await new Promise<Project | undefined>((resolve, reject) => {
    const r = d.transaction("projects").objectStore("projects").get("current");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  d.close();
  return p ? validateProject(p) : undefined;
}
export function download(blob: Blob, name: string) {
  const a = document.createElement("a"),
    url = URL.createObjectURL(blob);
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
export function fileData(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}
