import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { fontData, experimental_getFontFileURL } from "astro:assets";
import satori from "satori";
import sharp from "sharp";
import { join } from "node:path";
import { getFontPathByWeight } from "@/utils/getFontPathByWeight";
import { getPostSlug } from "@/utils/getPostPaths";
import { postFilter } from "@/utils/postFilter";
import config from "@/config";

export async function getStaticPaths() {
  if (!config.features.dynamicOgImage) {
    return [];
  }

  const posts = await getCollection("posts").then(p =>
    p.filter(post => postFilter(post) && !post.data.ogImage)
  );

  return posts.map(post => ({
    params: { slug: getPostSlug(post.id, post.filePath) },
    props: post,
  }));
}

export const GET: APIRoute = async ({ props, url }) => {
  if (!config.features.dynamicOgImage) {
    return new Response(null, { status: 404, statusText: "Not found" });
  }

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
              children: props.data.title,
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
                          children: props.data.author,
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
};
