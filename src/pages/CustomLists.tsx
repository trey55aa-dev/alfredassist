import { useMemo, useState } from "react";
import {
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  ListChecks,
  GripVertical,
  Palette,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import {
  CUSTOM_LISTS_KEY,
  CustomList,
  CustomListItem,
  LIST_COLORS,
  LIST_EMOJIS,
  SEED_LISTS,
  newItem,
  newList,
} from "@/lib/customLists";

export default function CustomLists() {
  const [lists, setLists] = useLocalStorage<CustomList[]>(
    CUSTOM_LISTS_KEY,
    SEED_LISTS
  );
  const [draftTitle, setDraftTitle] = useState("");

  const addList = () => {
    if (!draftTitle.trim()) return;
    setLists([newList(draftTitle), ...lists]);
    setDraftTitle("");
  };

  const updateList = (id: string, patch: Partial<CustomList>) =>
    setLists(lists.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  const deleteList = (id: string) =>
    setLists(lists.filter((l) => l.id !== id));

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Make it yours"
        title="Custom Lists"
        description="Build any list you like — packing, routines, projects, ideas. Edit titles, items, colors. Tick as you go."
      />

      {/* Add new list */}
      <Card className="p-4 bg-gradient-card border-border">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <ListChecks className="h-4 w-4 text-gold flex-shrink-0" />
            <Input
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addList()}
              placeholder="Name a new list… (e.g. Travel Prep, Weekend Reset)"
              className="bg-background/40 border-border focus-visible:ring-gold/40 focus-visible:border-gold/40"
            />
          </div>
          <Button
            onClick={addList}
            disabled={!draftTitle.trim()}
            className="bg-gold text-primary-foreground hover:bg-gold-soft"
          >
            <Plus className="h-4 w-4 mr-1" /> Create List
          </Button>
        </div>
      </Card>

      {lists.length === 0 ? (
        <Card className="p-10 bg-gradient-card border-border text-center">
          <p className="font-display italic text-muted-foreground">
            No lists yet, sir. Begin with one above.
          </p>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {lists.map((list) => (
            <ListCard
              key={list.id}
              list={list}
              onUpdate={(patch) => updateList(list.id, patch)}
              onDelete={() => deleteList(list.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- List card ---------- */

function ListCard({
  list,
  onUpdate,
  onDelete,
}: {
  list: CustomList;
  onUpdate: (patch: Partial<CustomList>) => void;
  onDelete: () => void;
}) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(list.title);
  const [newItemText, setNewItemText] = useState("");

  const done = list.items.filter((i) => i.done).length;
  const total = list.items.length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  const accent = list.color ?? LIST_COLORS[0].value;

  const saveTitle = () => {
    const t = titleDraft.trim();
    if (t) onUpdate({ title: t });
    else setTitleDraft(list.title);
    setEditingTitle(false);
  };

  const addItem = () => {
    if (!newItemText.trim()) return;
    onUpdate({ items: [...list.items, newItem(newItemText)] });
    setNewItemText("");
  };

  const updateItem = (id: string, patch: Partial<CustomListItem>) =>
    onUpdate({
      items: list.items.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    });

  const deleteItem = (id: string) =>
    onUpdate({ items: list.items.filter((i) => i.id !== id) });

  const clearCompleted = () =>
    onUpdate({ items: list.items.filter((i) => !i.done) });

  return (
    <Card
      className="p-5 bg-gradient-card border-border relative overflow-hidden"
      style={{ borderTop: `2px solid hsl(${accent})` }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-4">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* Emoji picker */}
          <Popover>
            <PopoverTrigger asChild>
              <button
                className="text-2xl hover:scale-110 transition-transform"
                title="Change icon"
              >
                {list.emoji ?? "✨"}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-56 bg-popover border-border">
              <div className="grid grid-cols-6 gap-1">
                {LIST_EMOJIS.map((e) => (
                  <button
                    key={e}
                    onClick={() => onUpdate({ emoji: e })}
                    className={`text-xl p-1.5 rounded hover:bg-sidebar-accent transition-colors ${
                      list.emoji === e ? "bg-sidebar-accent ring-1 ring-gold/50" : ""
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Title (inline edit) */}
          {editingTitle ? (
            <div className="flex items-center gap-1 flex-1">
              <Input
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveTitle();
                  if (e.key === "Escape") {
                    setTitleDraft(list.title);
                    setEditingTitle(false);
                  }
                }}
                autoFocus
                className="h-8 bg-background/40 border-border focus-visible:ring-gold/40 focus-visible:border-gold/40 font-display text-lg"
              />
              <button
                onClick={saveTitle}
                className="p-1 text-gold hover:bg-sidebar-accent rounded"
                aria-label="Save title"
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  setTitleDraft(list.title);
                  setEditingTitle(false);
                }}
                className="p-1 text-muted-foreground hover:bg-sidebar-accent rounded"
                aria-label="Cancel"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setTitleDraft(list.title);
                setEditingTitle(true);
              }}
              className="group flex items-center gap-2 min-w-0 text-left"
            >
              <h3 className="font-display text-xl truncate group-hover:text-gold transition-colors">
                {list.title}
              </h3>
              <Pencil className="h-3 w-3 text-muted-foreground/40 group-hover:text-gold transition-colors flex-shrink-0" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Color picker */}
          <Popover>
            <PopoverTrigger asChild>
              <button
                className="p-1.5 rounded hover:bg-sidebar-accent transition-colors text-muted-foreground hover:text-gold"
                title="Change color"
              >
                <Palette className="h-3.5 w-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-44 bg-popover border-border">
              <div className="grid grid-cols-3 gap-2">
                {LIST_COLORS.map((c) => (
                  <button
                    key={c.name}
                    onClick={() => onUpdate({ color: c.value })}
                    className={`flex flex-col items-center gap-1 p-2 rounded hover:bg-sidebar-accent transition-colors ${
                      list.color === c.value ? "bg-sidebar-accent ring-1 ring-gold/50" : ""
                    }`}
                  >
                    <div
                      className="h-5 w-5 rounded-full border border-border"
                      style={{ background: `hsl(${c.value})` }}
                    />
                    <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
                      {c.name}
                    </span>
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <button
            onClick={() => {
              if (confirm(`Delete list "${list.title}"?`)) onDelete();
            }}
            className="p-1.5 rounded hover:bg-sidebar-accent transition-colors text-muted-foreground/60 hover:text-destructive"
            aria-label="Delete list"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Progress */}
      <div className="mb-4">
        <div className="flex justify-between font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-1.5">
          <span>
            {done}/{total} done
          </span>
          <span style={{ color: `hsl(${accent})` }}>{pct}%</span>
        </div>
        <Progress value={pct} className="h-1" />
      </div>

      {/* Items */}
      <ul className="space-y-1.5 mb-3">
        {list.items.map((item) => (
          <ListItemRow
            key={item.id}
            item={item}
            accent={accent}
            onToggle={() => updateItem(item.id, { done: !item.done })}
            onEdit={(text) => updateItem(item.id, { text })}
            onDelete={() => deleteItem(item.id)}
          />
        ))}
        {list.items.length === 0 && (
          <li className="text-center text-xs text-muted-foreground italic py-3">
            No items yet — add one below.
          </li>
        )}
      </ul>

      {/* Add item */}
      <div className="flex gap-2">
        <Input
          value={newItemText}
          onChange={(e) => setNewItemText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addItem()}
          placeholder="Add an item…"
          className="h-9 bg-background/40 border-border focus-visible:ring-gold/40 focus-visible:border-gold/40 text-sm"
        />
        <Button
          onClick={addItem}
          disabled={!newItemText.trim()}
          size="sm"
          variant="outline"
          className="border-gold/30 hover:bg-gold/10 hover:text-gold"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {done > 0 && (
        <button
          onClick={clearCompleted}
          className="mt-3 font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground hover:text-gold transition-colors"
        >
          Clear {done} completed
        </button>
      )}
    </Card>
  );
}

/* ---------- Item row ---------- */

function ListItemRow({
  item,
  accent,
  onToggle,
  onEdit,
  onDelete,
}: {
  item: CustomListItem;
  accent: string;
  onToggle: () => void;
  onEdit: (text: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.text);

  const save = () => {
    const t = draft.trim();
    if (t) onEdit(t);
    else setDraft(item.text);
    setEditing(false);
  };

  return (
    <li
      className={`group flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors ${
        item.done ? "bg-muted/30" : "hover:bg-background/40"
      }`}
    >
      <GripVertical className="h-3 w-3 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
      <Checkbox
        checked={item.done}
        onCheckedChange={onToggle}
        className="border-gold/40 data-[state=checked]:bg-gold data-[state=checked]:text-primary-foreground flex-shrink-0"
        style={
          item.done
            ? ({ borderColor: `hsl(${accent})`, background: `hsl(${accent})` } as React.CSSProperties)
            : undefined
        }
      />
      {editing ? (
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") {
              setDraft(item.text);
              setEditing(false);
            }
          }}
          autoFocus
          className="h-7 text-sm bg-background/60 border-border focus-visible:ring-gold/40 focus-visible:border-gold/40"
        />
      ) : (
        <button
          onClick={() => {
            setDraft(item.text);
            setEditing(true);
          }}
          className={`flex-1 text-left text-sm truncate ${
            item.done ? "line-through text-muted-foreground" : "text-foreground"
          }`}
        >
          {item.text}
        </button>
      )}
      <button
        onClick={onDelete}
        className="p-1 text-muted-foreground/40 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
        aria-label="Delete item"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </li>
  );
}
