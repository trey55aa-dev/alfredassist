/** Export/import all alfred.* localStorage keys as a single JSON file. */

export interface BackupPayload {
  app: "alfred";
  version: 1;
  exportedAt: string;
  data: Record<string, unknown>;
}

export function buildBackup(): BackupPayload {
  const data: Record<string, unknown> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith("alfred.")) {
      try {
        data[key] = JSON.parse(localStorage.getItem(key) || "null");
      } catch {
        data[key] = localStorage.getItem(key);
      }
    }
  }
  return {
    app: "alfred",
    version: 1,
    exportedAt: new Date().toISOString(),
    data,
  };
}

export function downloadBackup() {
  const payload = buildBackup();
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `alfred-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function restoreFromFile(file: File): Promise<number> {
  const text = await file.text();
  const parsed = JSON.parse(text) as BackupPayload;
  if (parsed.app !== "alfred" || !parsed.data) {
    throw new Error("Invalid backup file");
  }
  let count = 0;
  for (const [key, value] of Object.entries(parsed.data)) {
    if (key.startsWith("alfred.")) {
      localStorage.setItem(key, JSON.stringify(value));
      count++;
    }
  }
  return count;
}
