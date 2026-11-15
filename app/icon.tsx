import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/** App icon: the Grace mark, white on black. */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#000",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: 999,
            border: "2.5px solid #EDEDED",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 3,
          }}
        >
          <div style={{ width: 3, height: 7, background: "#EDEDED", borderRadius: 2 }} />
          <div style={{ width: 3, height: 7, background: "#EDEDED", borderRadius: 2 }} />
        </div>
      </div>
    ),
    size
  );
}
