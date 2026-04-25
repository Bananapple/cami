export function Placeholder({ title }: { title: string }) {
  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-serif">{title}</h1>
      <p className="text-sm text-muted-foreground mt-2">Coming in V2.</p>
    </div>
  );
}
