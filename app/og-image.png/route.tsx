import { ImageResponse } from "next/og";

// Shared social preview image (LinkedIn, WhatsApp, X, Slack...). Rendered once
// at build time and served as a static PNG at /og-image.png.
export const dynamic = "force-static";

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          color: "#f8f7ff",
          backgroundColor: "#17142e",
          backgroundImage:
            "radial-gradient(circle at 10% 12%, rgba(114,87,255,0.45), transparent 40%), radial-gradient(circle at 92% 88%, rgba(200,255,98,0.18), transparent 38%), linear-gradient(145deg, #17142e 0%, #211947 55%, #111025 100%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: "#c8ff62",
              color: "#17142e",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 40,
              fontWeight: 800,
            }}
          >
            A
          </div>
          <div style={{ display: "flex", fontSize: 40, fontWeight: 800, letterSpacing: -1 }}>
            AutoApply<span style={{ color: "#c8ff62", marginLeft: 12 }}>CV</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 76, fontWeight: 800, lineHeight: 1.05, letterSpacing: -3, maxWidth: 980 }}>
            Free LinkedIn Auto Apply Bot for your next tech job
          </div>
          <div style={{ display: "flex", marginTop: 26, fontSize: 32, color: "#bdb8d4", maxWidth: 980 }}>
            AI resume tailoring, Easy Apply automation and a job tracker in one place.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 14 }}>
            {["LinkedIn Easy Apply", "Chrome extension", "Free to start"].map((label) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  padding: "10px 20px",
                  borderRadius: 999,
                  fontSize: 24,
                  fontWeight: 600,
                  color: "#eae7ff",
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.18)",
                }}
              >
                {label}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", fontSize: 26, fontWeight: 700, color: "#c8ff62" }}>autoapplycv.in</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
