import { useRef } from "react";
import { Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadBackup, restoreFromFile } from "@/lib/backup";
import { toast } from "sonner";

export function BackupRestore({ compact = false }: { compact?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleRestore = async (file: File | null) => {
    if (!file) return;
    try {
      const count = await restoreFromFile(file);
      toast.success(`Restored ${count} data sets. Reloading…`);
      setTimeout(() => window.location.reload(), 800);
    } catch (e) {
      toast.error(`Restore failed: ${(e as Error).message}`);
    }
  };

  return (
    <div className={`flex ${compact ? "gap-1" : "gap-2"}`}>
      <Button
        variant="outline"
        size="sm"
        onClick={downloadBackup}
        className="border-border text-muted-foreground hover:text-gold"
      >
        <Download className="h-3.5 w-3.5 mr-1" /> Export
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => inputRef.current?.click()}
        className="border-border text-muted-foreground hover:text-gold"
      >
        <Upload className="h-3.5 w-3.5 mr-1" /> Import
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={(e) => {
          handleRestore(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />
    </div>
  );
}
