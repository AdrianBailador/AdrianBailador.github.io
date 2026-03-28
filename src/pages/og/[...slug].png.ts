import type { APIRoute, GetStaticPaths } from "astro"
import { getCollection } from "astro:content"
import satori from "satori"
import sharp from "sharp"
import fs from "node:fs"
import path from "node:path"

export const getStaticPaths: GetStaticPaths = async () => {
  const posts = await getCollection("blog")
  return posts
    .filter(post => !post.data.draft)
    .map(post => ({
      params: { slug: post.id },
      props: { title: post.data.title, tags: post.data.tags },
    }))
}

export const GET: APIRoute = async ({ props }) => {
  const { title, tags } = props as { title: string; tags: string[] }

  const fontBold = fs.readFileSync(
    path.resolve(process.cwd(), "public/fonts/atkinson-bold.woff")
  )
  const fontRegular = fs.readFileSync(
    path.resolve(process.cwd(), "public/fonts/atkinson-regular.woff")
  )

  // Satori only supports Flexbox layout — every container needs display: flex
  const svg = await satori(
    {
      type: "div",
      props: {
        style: {
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#0a0a0a",
          fontFamily: "Atkinson",
        },
        children: [
          // Top gradient bar
          {
            type: "div",
            props: {
              style: {
                width: "100%",
                height: "8px",
                background: "linear-gradient(90deg, #4f6ef7 0%, #a78bfa 50%, #60a5fa 100%)",
                flexShrink: 0,
              },
            },
          },
          // Main content
          {
            type: "div",
            props: {
              style: {
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                padding: "64px 80px 60px 80px",
                flex: 1,
              },
              children: [
                // Title — centered vertically in available space
                {
                  type: "div",
                  props: {
                    style: {
                      display: "flex",
                      alignItems: "flex-start",
                      flex: 1,
                      paddingBottom: "32px",
                    },
                    children: {
                      type: "div",
                      props: {
                        style: {
                          fontSize: title.length > 50 ? "52px" : "64px",
                          fontWeight: 700,
                          color: "#ffffff",
                          lineHeight: 1.15,
                          letterSpacing: "-1.5px",
                        },
                        children: title,
                      },
                    },
                  },
                },
                // Bottom: tags + author row
                {
                  type: "div",
                  props: {
                    style: {
                      display: "flex",
                      flexDirection: "column",
                      gap: "20px",
                    },
                    children: [
                      // Tags row
                      {
                        type: "div",
                        props: {
                          style: {
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "10px",
                          },
                          children: tags.slice(0, 5).map((tag: string) => ({
                            type: "div",
                            props: {
                              style: {
                                display: "flex",
                                backgroundColor: "rgba(255,255,255,0.08)",
                                color: "rgba(255,255,255,0.55)",
                                padding: "6px 18px",
                                borderRadius: "999px",
                                fontSize: "20px",
                                fontWeight: 400,
                                border: "1px solid rgba(255,255,255,0.12)",
                              },
                              children: `#${tag}`,
                            },
                          })),
                        },
                      },
                      // Divider
                      {
                        type: "div",
                        props: {
                          style: {
                            width: "100%",
                            height: "1px",
                            backgroundColor: "rgba(255,255,255,0.1)",
                          },
                        },
                      },
                      // Author row
                      {
                        type: "div",
                        props: {
                          style: {
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          },
                          children: [
                            {
                              type: "span",
                              props: {
                                style: {
                                  color: "rgba(255,255,255,0.4)",
                                  fontSize: "22px",
                                  fontWeight: 400,
                                },
                                children: "Adrian Bailador",
                              },
                            },
                            {
                              type: "span",
                              props: {
                                style: {
                                  color: "#a78bfa",
                                  fontSize: "20px",
                                  fontWeight: 700,
                                },
                                children: "Read article →",
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
        ],
      },
    },
    {
      width: 1200,
      height: 630,
      fonts: [
        {
          name: "Atkinson",
          data: fontBold.buffer.slice(
            fontBold.byteOffset,
            fontBold.byteOffset + fontBold.byteLength
          ) as ArrayBuffer,
          weight: 700,
          style: "normal",
        },
        {
          name: "Atkinson",
          data: fontRegular.buffer.slice(
            fontRegular.byteOffset,
            fontRegular.byteOffset + fontRegular.byteLength
          ) as ArrayBuffer,
          weight: 400,
          style: "normal",
        },
      ],
    }
  )

  const png = await sharp(Buffer.from(svg)).png().toBuffer()

  return new Response(png, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  })
}
