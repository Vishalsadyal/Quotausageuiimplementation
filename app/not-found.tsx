export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "24px",
        background: "#f7f7fb",
        color: "#17152b",
        fontFamily: "var(--font-inter), ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 440 }}>
        <div style={{ fontSize: "4.5rem", fontWeight: 800, color: "#6047f5", lineHeight: 1 }}>404</div>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700, margin: "16px 0 8px" }}>Page not found</h1>
        <p style={{ color: "#2b3544", margin: "0 0 24px" }}>
          The page you are looking for doesn&apos;t exist or has moved.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <a
            href="/"
            style={{ background: "#6047f5", color: "#fff", padding: "12px 20px", borderRadius: 10, fontWeight: 600, textDecoration: "none" }}
          >
            Go to homepage
          </a>
          <a
            href="/blog"
            style={{ background: "#fff", color: "#17152b", border: "1px solid #e6e3ee", padding: "12px 20px", borderRadius: 10, fontWeight: 600, textDecoration: "none" }}
          >
            Read the blog
          </a>
        </div>
      </div>
    </div>
  );
}
