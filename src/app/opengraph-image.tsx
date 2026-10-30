import { ImageResponse } from "next/og";

export const alt = "azentio.ai — Build Intelligence. Create Impact.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const NAVY = "#171b3a";
const GREEN = "#69d393";
const MINT = "#5fffbe";

const NODES: [number, number, number][] = [
  [820, 150, 7],
  [820, 260, 7],
  [820, 370, 7],
  [820, 480, 7],
  [960, 205, 9],
  [960, 315, 16],
  [960, 425, 9],
  [1100, 260, 10],
  [1100, 370, 10],
];

/** Default social card for every public page (navy, green node network, wordmark). */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: NAVY,
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        {NODES.map(([x, y, r], i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x - r,
              top: y - r,
              width: r * 2,
              height: r * 2,
              borderRadius: 9999,
              border: `2px solid ${i === 5 ? MINT : GREEN}`,
              background: i === 5 ? MINT : NAVY,
              display: "flex",
            }}
          />
        ))}
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 12, background: GREEN, display: "flex" }} />
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 96px", gap: 28, width: 760 }}>
          <div style={{ display: "flex", fontSize: 44, fontWeight: 700, letterSpacing: -1 }}>
            <span style={{ color: GREEN }}>a</span>
            <span>zent</span>
            <span style={{ color: GREEN }}>i</span>
            <span>o</span>
            <span style={{ color: GREEN }}>.ai</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", fontSize: 68, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>
            <span>Build Intelligence.</span>
            <span style={{ color: GREEN }}>Create Impact.</span>
          </div>
          <div style={{ display: "flex", fontSize: 28, color: "#cbd5e1", lineHeight: 1.35 }}>
            Enterprise AI for banking, insurance, capital markets and ERP.
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
