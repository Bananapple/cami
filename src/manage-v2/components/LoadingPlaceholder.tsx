export function LoadingPlaceholder({ text }: { text: string }) {
  return (
    <div style={{ padding: "16px 14px", color: "var(--ink-muted)", fontSize: 13 }}>
      {text}
    </div>
  );
}
