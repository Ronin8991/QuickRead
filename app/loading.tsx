export default function Loading() {
  return (
    <div className="loading-screen">
      <div className="loading-card">
        <div className="loading-pulse" />
        <div>Preparing QuickRead…</div>
        <div style={{ color: "var(--ink-muted)", fontSize: 13 }}>
          Tuning the reading flow.
        </div>
      </div>
    </div>
  );
}
