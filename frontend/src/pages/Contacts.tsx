import { useEffect, useState, type FormEvent } from "react";
import {
  listContacts,
  createContact,
  updateContact,
  deleteContact,
  getContactSuggestions,
  type Contact,
  type ContactSuggestion,
} from "@/lib/api";
import { useContacts } from "@/lib/contacts";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup } from "@/components/ui/toggle-group";
import { motion, AnimatePresence } from "motion/react";
import {
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Users,
  Phone,
  Mail,
} from "lucide-react";

type IdType = "phone" | "email";

export default function Contacts() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Add form
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newIdentifier, setNewIdentifier] = useState("");
  const [newType, setNewType] = useState<IdType>("phone");
  const [adding, setAdding] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Suggestions
  const [suggestions, setSuggestions] = useState<ContactSuggestion[]>([]);
  const [suggestionName, setSuggestionName] = useState<Record<string, string>>(
    {},
  );
  const [addingSuggestion, setAddingSuggestion] = useState<string | null>(null);

  const { refresh: refreshGlobal } = useContacts();

  const load = async () => {
    try {
      const [list, sugg] = await Promise.all([
        listContacts(),
        getContactSuggestions(),
      ]);
      setContacts(list);
      setSuggestions(sugg);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newIdentifier.trim()) return;
    setAdding(true);
    setError("");
    try {
      await createContact({
        identifier: newIdentifier.trim(),
        identifier_type: newType,
        name: newName.trim(),
      });
      setNewName("");
      setNewIdentifier("");
      setShowAdd(false);
      await load();
      await refreshGlobal();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAdding(false);
    }
  };

  const handleUpdate = async (id: number) => {
    if (!editName.trim()) return;
    setSaving(true);
    setError("");
    try {
      await updateContact(id, editName.trim());
      setEditingId(null);
      await load();
      await refreshGlobal();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddSuggestion = async (identifier: string, idType: string) => {
    const name = suggestionName[identifier]?.trim();
    if (!name) return;
    setAddingSuggestion(identifier);
    setError("");
    try {
      await createContact({
        identifier,
        identifier_type: idType as "phone" | "email",
        name,
      });
      setSuggestionName((prev) => {
        const next = { ...prev };
        delete next[identifier];
        return next;
      });
      await load();
      await refreshGlobal();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAddingSuggestion(null);
    }
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    setError("");
    try {
      await deleteContact(id);
      await load();
      await refreshGlobal();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-4xl tracking-wide text-chalk">
            CONTACTS
          </h1>
          <p className="text-chalk-dim text-sm mt-1">
            Save friendly names for people you interact with. Only you can see
            these.
          </p>
        </div>
        {!showAdd && (
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="size-3.5" />
            Add
          </Button>
        )}
      </div>

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-lose text-xs font-medium"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Add form */}
      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <Card className="border-accent/30">
              <CardContent>
                <form onSubmit={handleAdd} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="e.g. John"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <ToggleGroup
                      value={newType}
                      onValueChange={(v) => setNewType(v as IdType)}
                      options={[
                        {
                          value: "phone" as const,
                          label: (
                            <span className="flex items-center gap-1.5">
                              <Phone className="size-3" />
                              Phone
                            </span>
                          ),
                        },
                        {
                          value: "email" as const,
                          label: (
                            <span className="flex items-center gap-1.5">
                              <Mail className="size-3" />
                              Email
                            </span>
                          ),
                        },
                      ]}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>
                      {newType === "phone" ? "Phone number" : "Email address"}
                    </Label>
                    <Input
                      type={newType === "phone" ? "tel" : "email"}
                      value={newIdentifier}
                      onChange={(e) => setNewIdentifier(e.target.value)}
                      placeholder={
                        newType === "phone"
                          ? "+1 555 123 4567"
                          : "name@example.com"
                      }
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" disabled={adding} className="flex-1">
                      {adding ? "Saving..." : "Save Contact"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setShowAdd(false);
                        setNewName("");
                        setNewIdentifier("");
                        setError("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {loading && (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && contacts.length === 0 && !showAdd && (
        <Card>
          <CardContent className="text-center py-10 space-y-3">
            <Users className="size-10 text-ink-muted mx-auto" />
            <p className="text-chalk-dim text-sm">
              No contacts yet. Add someone to give them a friendly name.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Contact list */}
      <div className="space-y-2">
        {contacts.map((contact, i) => {
          const isEditing = editingId === contact.id;
          const isDeleting = deletingId === contact.id;

          return (
            <motion.div
              key={contact.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-ink-light border border-ink-border/50 hover:border-ink-muted transition-colors">
                {/* Icon */}
                <span className="shrink-0 size-9 rounded-lg bg-accent/10 text-accent flex items-center justify-center">
                  {contact.identifier_type === "phone" ? (
                    <Phone className="size-4" />
                  ) : (
                    <Mail className="size-4" />
                  )}
                </span>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleUpdate(contact.id);
                      }}
                      className="flex items-center gap-2"
                    >
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="h-8 text-sm"
                        autoFocus
                      />
                      <Button
                        type="submit"
                        size="sm"
                        variant="ghost"
                        disabled={saving}
                        className="text-win hover:text-win"
                      >
                        <Check className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingId(null)}
                        className="text-chalk-dim"
                      >
                        <X className="size-3.5" />
                      </Button>
                    </form>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-chalk">
                          {contact.name}
                        </span>
                        <Badge variant="muted">{contact.identifier_type}</Badge>
                      </div>
                      <span className="block font-mono text-[11px] text-ink-muted truncate">
                        {contact.identifier}
                      </span>
                    </>
                  )}
                </div>

                {/* Actions */}
                {!isEditing && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => {
                        setEditingId(contact.id);
                        setEditName(contact.name);
                      }}
                      className="p-1.5 rounded-lg text-ink-muted hover:text-chalk hover:bg-ink-lighter transition-colors cursor-pointer"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(contact.id)}
                      disabled={isDeleting}
                      className="p-1.5 rounded-lg text-ink-muted hover:text-lose hover:bg-lose/10 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Suggestions */}
      {!loading && suggestions.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-semibold text-chalk">
              People you&apos;ve interacted with
            </h2>
            <div className="flex-1 h-px bg-ink-border/30" />
          </div>
          <div className="space-y-2">
            {suggestions.map((s, i) => (
              <motion.div
                key={s.identifier}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-ink-light border border-dashed border-ink-border/50 hover:border-accent/30 transition-colors">
                  <span className="shrink-0 size-9 rounded-lg bg-ink-lighter text-ink-muted flex items-center justify-center">
                    {s.identifier_type === "phone" ? (
                      <Phone className="size-4" />
                    ) : (
                      <Mail className="size-4" />
                    )}
                  </span>

                  <div className="flex-1 min-w-0">
                    <span className="block font-mono text-xs text-chalk-dim truncate">
                      {s.identifier}
                    </span>
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleAddSuggestion(s.identifier, s.identifier_type);
                    }}
                    className="flex items-center gap-2 shrink-0"
                  >
                    <Input
                      value={suggestionName[s.identifier] ?? ""}
                      onChange={(e) =>
                        setSuggestionName((prev) => ({
                          ...prev,
                          [s.identifier]: e.target.value,
                        }))
                      }
                      placeholder="Name"
                      className="h-8 w-28 text-xs"
                    />
                    <Button
                      type="submit"
                      size="sm"
                      disabled={
                        !suggestionName[s.identifier]?.trim() ||
                        addingSuggestion === s.identifier
                      }
                    >
                      {addingSuggestion === s.identifier ? (
                        "..."
                      ) : (
                        <>
                          <Plus className="size-3" />
                          Save
                        </>
                      )}
                    </Button>
                  </form>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
