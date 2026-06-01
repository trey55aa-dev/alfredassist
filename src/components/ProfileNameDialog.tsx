import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Dialog to set the name Alfred should address you by. Saves to profiles. */
export function ProfileNameDialog({ open, onOpenChange }: Props) {
  const { profile, updateDisplayName } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState(profile?.display_name ?? "");
  const [saving, setSaving] = useState(false);

  // Sync when profile loads/changes while closed.
  useEffect(() => {
    if (!open) setName(profile?.display_name ?? "");
  }, [profile?.display_name, open]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateDisplayName(name);
      toast({
        title: name.trim() ? `At your service, ${name.trim()}.` : "Name cleared",
      });
      onOpenChange(false);
    } catch (err) {
      toast({
        title: "Could not save name",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>What shall I call you?</DialogTitle>
          <DialogDescription>
            Alfred will greet you and address you by this name throughout the app.
          </DialogDescription>
        </DialogHeader>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
          }}
          placeholder="e.g. Trey"
          autoFocus
          className="bg-background/50 border-border"
        />
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-gradient-gold text-primary-foreground hover:opacity-90"
          >
            {saving ? "Saving…" : "Save name"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
