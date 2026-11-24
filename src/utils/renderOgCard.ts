import { fontData, experimental_getFontFileURL } from "astro:assets";
import satori from "satori";
import sharp from "sharp";
import { join } from "node:path";
import { getFontPathByWeight } from "@/utils/getFontPathByWeight";
import config from "@/config";

/**
 * Renders the site's 1200x630 link-preview card (title, optional subtitle,
 * avatar, name and domain) as a PNG response.
 */
export async function renderOgCard(
  title: string,
  url: URL,
  subtitle?: string
): Promise<Response> {
  const fonts = fontData["--font-google-sans-code"];
  const regularFontPath = getFontPathByWeight(fonts, 400);
  const boldFontPath = getFontPathByWeight(fonts, 700);

  if (regularFontPath === undefined || boldFontPath === undefined) {
    throw new Error("Cannot find the font path.");
  }

  const [regularData, boldData] = await Promise.all([
    fetch(experimental_getFontFileURL(regularFontPath, url)).then(res =>
      res.arrayBuffer()
    ),
    fetch(experimental_getFontFileURL(boldFontPath, url)).then(res =>
      res.arrayBuffer()
    ),
  ]);

  // 400px pixel art scaled 4:1 with nearest-neighbour so it stays crisp.
  const avatarPng = await sharp(
    join(process.cwd(), "src", "assets", "avatar.png")
  )
    .resize(100, 100, { kernel: "nearest" })
    .png()
    .toBuffer();
  const avatarDataUrl = `data:image/png;base64,${avatarPng.toString("base64")}`;

  const heading = [
    {
      type: "p",
      props: {
        style: {
          fontSize: 64,
          fontWeight: "bold",
          lineHeight: 1.15,
          margin: 0,
          maxHeight: "300px",
          overflow: "hidden",
        },
        children: title,
      },
    },
    ...(subtitle
      ? [
          {
            type: "p",
            props: {
              style: {
                fontSize: 34,
                lineHeight: 1.35,
                margin: "28px 0 0",
                opacity: 0.8,
              },
              children: subtitle,
            },
          },
        ]
      : []),
  ];

  const svg = await satori(
    {
      key: null,
      type: "div",
      props: {
        style: {
          background: "#fdfdfd",
          boxSizing: "border-box",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px 92px",
          borderBottom: "20px solid #006cac",
          color: "#282728",
        },
        children: [
          {
            type: "div",
            props: {
              style: { display: "flex", flexDirection: "column" },
              children: heading,
            },
          },
          {
            type: "div",
            props: {
              style: { display: "flex", alignItems: "center" },
              children: [
                {
                  type: "img",
                  props: {
                    src: avatarDataUrl,
                    width: 100,
                    height: 100,
                    style: { borderRadius: "12px", marginRight: "28px" },
                  },
                },
                {
                  type: "div",
                  props: {
                    style: { display: "flex", flexDirection: "column" },
                    children: [
                      {
                        type: "span",
                        props: {
                          style: { fontSize: 32, fontWeight: "bold" },
                          children: config.site.author,
                        },
                      },
                      {
                        type: "span",
                        props: {
                          style: {
                            fontSize: 28,
                            fontWeight: "bold",
                            color: "#006cac",
                            marginTop: "6px",
                          },
                          children: new URL(config.site.url).hostname,
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      width: 1200,
      height: 630,
      embedFont: true,
      fonts: [
        {
          name: "Google Sans Code",
          data: regularData,
          weight: 400,
          style: "normal",
        },
        {
          name: "Google Sans Code",
          data: boldData,
          weight: 700,
          style: "normal",
        },
      ],
    }
  );

  const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();

  return new Response(new Uint8Array(pngBuffer), {
    headers: { "Content-Type": "image/png" },
  });
}
