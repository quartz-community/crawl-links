import { describe, it, expect } from "vitest";
import type { Root, Element } from "hast";
import { VFile } from "vfile";
import type { BuildCtx } from "@quartz-community/types";
import type { FullSlug } from "@quartz-community/utils";
import { CrawlLinks } from "../src/transformer";

function run(el: Element, allSlugs: string[], fileSlug: string): Element {
  const tree: Root = { type: "root", children: [el] };
  const plugin = CrawlLinks({ markdownLinkResolution: "shortest" });
  const plugins = plugin.htmlPlugins!({ allSlugs } as unknown as BuildCtx);
  const transformer = (plugins[0] as () => (tree: Root, file: VFile) => void)();
  const file = new VFile();
  file.data.slug = fileSlug as FullSlug;
  transformer(tree, file);
  return tree.children[0] as Element;
}

const el = (tagName: string, properties: Element["properties"]): Element => ({
  type: "element",
  tagName,
  properties,
  children: [],
});

describe("resource links in <object data> and <source src>", () => {
  const allSlugs = ["index", "features/svg-embed", "static/star.svg", "media/clip.mp4"];

  it("resolves an SVG <object data> embed like an <img src>", () => {
    const obj = run(
      el("object", { data: "star.svg", type: "image/svg+xml" }),
      allSlugs,
      "features/svg-embed",
    );
    const img = run(el("img", { src: "star.svg" }), allSlugs, "features/svg-embed");
    expect(obj.properties.data).toBe("../static/star.svg");
    expect(obj.properties.data).toBe(img.properties.src);
  });

  it("resolves <source src>", () => {
    const src = run(el("source", { src: "clip.mp4" }), allSlugs, "features/svg-embed");
    expect(src.properties.src).toBe("../media/clip.mp4");
  });

  it("leaves absolute and fragment references untouched", () => {
    expect(
      run(el("object", { data: "https://example.com/a.svg" }), allSlugs, "index").properties.data,
    ).toBe("https://example.com/a.svg");
    expect(run(el("object", { data: "#frag" }), allSlugs, "index").properties.data).toBe("#frag");
  });
});
