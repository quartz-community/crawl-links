import { describe, it, expect } from "vitest";
import type { Root, Element } from "hast";
import { VFile } from "vfile";
import type { BuildCtx } from "@quartz-community/types";
import type { FullSlug } from "@quartz-community/utils";
import { CrawlLinks } from "../src/transformer";
import type { CrawlLinksOptions } from "../src/transformer";

function makeTree(el: Element): Root {
  return { type: "root", children: [el] };
}

function runTransform(
  tree: Root,
  opts: Partial<CrawlLinksOptions>,
  allSlugs: string[],
  fileSlug: string,
): Element {
  const plugin = CrawlLinks(opts);
  const ctx = { allSlugs } as unknown as BuildCtx;
  const plugins = plugin.htmlPlugins!(ctx);
  const factory = plugins[0] as () => (tree: Root, file: VFile) => void;
  const transformer = factory();

  const file = new VFile();
  file.data.slug = fileSlug as FullSlug;

  transformer(tree, file);
  return tree.children[0] as Element;
}

function img(src: string): Element {
  return { type: "element", tagName: "img", properties: { src }, children: [] };
}

function object(data: string | undefined): Element {
  return {
    type: "element",
    tagName: "object",
    properties: data === undefined ? {} : { data, type: "image/svg+xml" },
    children: [],
  };
}

describe("object[data] resolution (SVG embeds)", () => {
  const opts: Partial<CrawlLinksOptions> = { markdownLinkResolution: "shortest" };
  const allSlugs = ["sub/page", "diagram"];
  const fileSlug = "sub/page";

  it("resolves <object data> to a page-relative path, like <img src>", () => {
    const resolvedImg = runTransform(makeTree(img("diagram")), opts, allSlugs, fileSlug);
    const resolvedObj = runTransform(makeTree(object("diagram")), opts, allSlugs, fileSlug);

    // <img src> is rewritten from the bare slug to a page-relative path...
    expect(resolvedImg.properties?.src).not.toBe("diagram");
    // ...and <object data> now gets the exact same resolution.
    expect(resolvedObj.properties?.data).toBe(resolvedImg.properties?.src);
  });

  it("leaves absolute <object data> URLs untouched", () => {
    const data = "https://example.com/diagram.svg";
    const resolved = runTransform(makeTree(object(data)), opts, allSlugs, fileSlug);
    expect(resolved.properties?.data).toBe(data);
  });

  it("does not throw for an <object> without a data attribute", () => {
    expect(() => runTransform(makeTree(object(undefined)), opts, allSlugs, fileSlug)).not.toThrow();
  });
});
