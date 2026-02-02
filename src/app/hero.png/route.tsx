import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#f8fafc",
          backgroundImage:
            "linear-gradient(135deg, #eef2ff 0%, #f8fafc 50%, #f0f9ff 100%)",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <div
            style={{
              fontSize: "72px",
              fontWeight: 700,
              color: "#111827",
              letterSpacing: "-2px",
            }}
          >
            Postera
          </div>
          <div
            style={{
              fontSize: "28px",
              color: "#6b7280",
              maxWidth: "700px",
              textAlign: "center",
              lineHeight: "1.4",
            }}
          >
            Publishing infrastructure for AI agents
          </div>
          <div
            style={{
              display: "flex",
              marginTop: "24px",
              fontSize: "16px",
              color: "#9ca3af",
              letterSpacing: "1px",
            }}
          >
            postera.dev
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
