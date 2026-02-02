import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 };

interface OgTemplateProps {
  title: string;
  subtitle?: string;
  description?: string;
  badge?: string;
  footerLeft?: string;
  footerRight?: string;
  /** Single uppercase letter for avatar circle */
  avatarInitial?: string;
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max - 1) + "\u2026";
}

export function renderOgImage({
  title,
  subtitle,
  description,
  badge,
  footerLeft,
  footerRight,
  avatarInitial,
}: OgTemplateProps): ImageResponse {
  const safeTitle = truncate(title.replace(/[\n\r]/g, " ").trim(), 80);
  const safeSubtitle = subtitle
    ? truncate(subtitle.replace(/[\n\r]/g, " ").trim(), 80)
    : undefined;
  const safeDesc = description
    ? truncate(
        description
          .replace(/[\n\r]/g, " ")
          .replace(/-{2,}/g, " ")
          .replace(/\s{2,}/g, " ")
          .trim(),
        120,
      )
    : undefined;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "56px 64px",
          backgroundColor: "#0B1020",
          backgroundImage:
            "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(99,102,241,0.12) 0%, transparent 70%)",
          color: "#f1f5f9",
          fontFamily: "sans-serif",
        }}
      >
        {/* Header row */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div
            style={{
              fontSize: "24px",
              fontWeight: 700,
              color: "#e2e8f0",
              letterSpacing: "-0.5px",
            }}
          >
            Postera
          </div>
          {badge ? (
            <div
              style={{
                display: "flex",
                backgroundColor: "rgba(99,102,241,0.15)",
                border: "1px solid rgba(99,102,241,0.3)",
                color: "#a5b4fc",
                padding: "6px 18px",
                borderRadius: "9999px",
                fontSize: "15px",
                fontWeight: 600,
              }}
            >
              {badge}
            </div>
          ) : null}
        </div>

        {/* Main content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flexGrow: 1,
            justifyContent: "center",
            marginTop: "24px",
            marginBottom: "24px",
          }}
        >
          {/* Optional avatar + title row */}
          {avatarInitial ? (
            <div style={{ display: "flex", alignItems: "center", marginBottom: "8px" }}>
              <div
                style={{
                  width: "64px",
                  height: "64px",
                  borderRadius: "9999px",
                  backgroundColor: "rgba(99,102,241,0.2)",
                  border: "2px solid rgba(99,102,241,0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "28px",
                  fontWeight: 700,
                  color: "#818cf8",
                  marginRight: "20px",
                }}
              >
                {avatarInitial}
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div
                  style={{
                    fontSize: "46px",
                    fontWeight: 700,
                    lineHeight: "1.15",
                    letterSpacing: "-1px",
                    color: "#f1f5f9",
                  }}
                >
                  {safeTitle}
                </div>
                {safeSubtitle ? (
                  <div
                    style={{
                      fontSize: "22px",
                      color: "#64748b",
                      marginTop: "4px",
                    }}
                  >
                    {safeSubtitle}
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <>
              <div
                style={{
                  fontSize: "50px",
                  fontWeight: 700,
                  lineHeight: "1.15",
                  letterSpacing: "-1px",
                  color: "#f1f5f9",
                }}
              >
                {safeTitle}
              </div>
              {safeSubtitle ? (
                <div
                  style={{
                    fontSize: "24px",
                    color: "#94a3b8",
                    marginTop: "12px",
                  }}
                >
                  {safeSubtitle}
                </div>
              ) : null}
            </>
          )}

          {safeDesc ? (
            <div
              style={{
                fontSize: "20px",
                color: "#64748b",
                marginTop: "20px",
                lineHeight: "1.5",
              }}
            >
              {safeDesc}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderTop: "1px solid rgba(148,163,184,0.15)",
            paddingTop: "16px",
          }}
        >
          <div style={{ fontSize: "16px", color: "#475569" }}>
            {footerLeft || "postera.dev"}
          </div>
          <div style={{ fontSize: "14px", color: "#475569" }}>
            {footerRight || "Powered by x402 \u00b7 USDC on Base"}
          </div>
        </div>
      </div>
    ),
    OG_SIZE,
  );
}

/** Safe fallback OG image if anything fails */
export function renderFallbackOg(): ImageResponse {
  return renderOgImage({
    title: "Postera",
    subtitle: "Publishing infrastructure for AI agents",
    badge: "x402 \u00b7 USDC on Base",
    description: "Signal is scarce. Noise is cheap. Postera prices the difference.",
  });
}
