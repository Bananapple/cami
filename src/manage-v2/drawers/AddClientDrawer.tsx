import { useEffect, useState } from "react";
import { Drawer } from "../components/Drawer";
import { Button } from "../components/Button";
import { Field, FieldRow, inputStyle } from "../components/Field";
import { useStudioContext } from "@/context/StudioContext";
import { toast } from "sonner";
import { Copy, Check } from "lucide-react";

// MVP: collect prospect info + produce a copy-able sign-up link the
// owner can paste into a chat/email. The actual email-an-invite plumbing
// (invite-member Edge Function) is a follow-up — see task list.

const EMPTY_DRAFT = {
  full_name: "",
  email: "",
  phone: "",
  level: "all levels",
};

export function AddClientDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const studioCtx = useStudioContext();
  const studioSlug = studioCtx?.studio?.slug;
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) {
      setDraft({ ...EMPTY_DRAFT });
      setLink(null);
      setCopied(false);
    }
  }, [open]);

  const generate = () => {
    if (!draft.full_name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!draft.email.trim()) {
      toast.error("Email is required");
      return;
    }
    // For now: produce a /joinnow link with the email prefilled. The user
    // can paste this into Whatsapp/SMS/email manually. Once the
    // invite-member Edge Function lands this becomes a single click.
    const base = window.location.origin;
    const url = `${base}/joinnow?email=${encodeURIComponent(draft.email.trim())}`;
    setLink(url);
  };

  const copy = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success("Link copied");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Add client"
      subtitle="Generate a sign-up link to share with a new member"
      actions={
        link ? (
          <Button variant="primary" onClick={onClose}>Done</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button variant="primary" onClick={generate}>Generate invite link</Button>
          </>
        )
      }
    >
      <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
        {!link && (
          <>
            <FieldRow>
              <Field label="Full name">
                <input
                  type="text"
                  value={draft.full_name}
                  onChange={(e) => setDraft((d) => ({ ...d, full_name: e.target.value }))}
                  placeholder="Frida Kalo"
                  style={inputStyle}
                />
              </Field>
              <Field label="Phone">
                <input
                  type="tel"
                  value={draft.phone}
                  onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
                  placeholder="+47 …"
                  style={inputStyle}
                />
              </Field>
            </FieldRow>

            <Field label="Email">
              <input
                type="email"
                value={draft.email}
                onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
                placeholder="frida@example.com"
                style={inputStyle}
              />
            </Field>

            <Field label="Level" help="Optional starting level (member can update later)">
              <select
                value={draft.level}
                onChange={(e) => setDraft((d) => ({ ...d, level: e.target.value }))}
                style={inputStyle as React.CSSProperties}
              >
                <option value="beginner">Beginner</option>
                <option value="all levels">All levels</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </Field>

            <p style={{ margin: 0, fontSize: 12, color: "var(--ink-muted)" }}>
              We'll generate a sign-up link you can paste into a message. Auto-emailed invites
              are coming soon.
            </p>
          </>
        )}

        {link && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={{ margin: 0, fontSize: 13, color: "var(--ink)" }}>
              Share this link with <strong>{draft.full_name}</strong> ({draft.email}). When they
              sign up they'll be added to your client list automatically.
            </p>
            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                padding: "10px 12px",
                background: "var(--paper)",
                border: "1px solid var(--line)",
                borderRadius: "var(--r-card)",
              }}
            >
              <code
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 12,
                  color: "var(--ink)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  fontFamily: "'JetBrains Mono', monospace",
                }}
                title={link}
              >
                {link}
              </code>
              <Button
                variant="secondary"
                size="sm"
                onClick={copy}
                icon={copied ? <Check size={12} /> : <Copy size={12} />}
              >
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Drawer>
  );
}
