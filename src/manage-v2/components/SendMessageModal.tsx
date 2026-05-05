import { useState } from "react";
import { Button } from "./Button";
import { Field, inputStyle } from "./Field";

export function SendMessageModal({
  open,
  memberName,
  memberEmail,
  onSend,
  onClose,
}: {
  open: boolean;
  memberName: string;
  memberEmail: string;
  onSend: (subject: string, body: string) => Promise<void>;
  onClose: () => void;
}) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const canSend = subject.trim().length > 0 && body.trim().length > 0;

  async function handleSend() {
    if (!canSend || loading) return;
    setLoading(true);
    setError(null);
    try {
      await onSend(subject.trim(), body.trim());
      // Reset form on success
      setSubject("");
      setBody("");
    } catch (e: any) {
      setError(e?.message ?? "Failed to send message");
      setLoading(false);
    }
  }

  function handleClose() {
    if (loading) return;
    setSubject("");
    setBody("");
    setError(null);
    onClose();
  }

  return (
    <>
      {/* Overlay */}
      <div
        onClick={handleClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.45)",
          zIndex: 300,
        }}
      />

      {/* Card */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Message to ${memberName}`}
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 301,
          background: "var(--surface)",
          borderRadius: "var(--r-card)",
          border: "1px solid var(--line)",
          width: "min(480px, calc(100vw - 32px))",
          boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div style={{ padding: "20px 20px 16px" }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "var(--ink)", lineHeight: 1.3 }}>
            Message to {memberName}
          </h3>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--ink-muted)" }}>
            {memberEmail}
          </p>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: "var(--line-soft)" }} />

        {/* Body */}
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          <Field label="Subject">
            <input
              style={inputStyle}
              type="text"
              placeholder="e.g. Class cancellation this Saturday"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={loading}
              autoFocus
            />
          </Field>

          <Field label="Message">
            <textarea
              style={{
                ...inputStyle,
                height: "auto",
                minHeight: 100,
                padding: "8px 10px",
                resize: "vertical",
                lineHeight: 1.6,
              }}
              rows={4}
              placeholder="Write your message here…"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={loading}
            />
          </Field>

          {error && (
            <p style={{ margin: 0, fontSize: 13, color: "var(--bad)" }}>{error}</p>
          )}
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: "var(--line-soft)" }} />

        {/* Footer */}
        <div
          style={{
            padding: "12px 20px",
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
          }}
        >
          <Button variant="ghost" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSend}
            loading={loading}
            disabled={!canSend}
          >
            Send
          </Button>
        </div>
      </div>
    </>
  );
}
