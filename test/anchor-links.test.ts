import { describe, it, expect } from "vitest";
import type { Root, Element } from "hast";
import { VFile } from "vfile";
import type { BuildCtx } from "@quartz-community/types";
import type { FullSlug } from "@quartz-community/utils";
import { obsidianHeadingAnchor, slugHeading } from "@quartz-community/utils";
import { CrawlLinks } from "../src/transformer";
import type { CrawlLinksOptions } from "../src/transformer";

const h2 = (id: string, text: string): Element => ({
  type: "element",
  tagName: "h2",
  properties: { id },
  children: [{ type: "text", value: text }],
});

const a = (href: string): Element => ({
  type: "element",
  tagName: "a",
  properties: { href },
  children: [{ type: "text", value: "link" }],
});

function run(children: Element[], opts: Partial<CrawlLinksOptions> = {}): Element[] {
  const tree: Root = { type: "root", children };
  const plugin = CrawlLinks(opts);
  const ctx = { allSlugs: ["page", "b"] } as unknown as BuildCtx;
  const factory = plugin.htmlPlugins!(ctx)[0] as () => (tree: Root, file: VFile) => void;
  const file = new VFile();
  file.data.slug = "page" as FullSlug;
  factory()(tree, file);
  return tree.children as Element[];
}

const hrefOf = (el: Element) => el.properties.href;

// quartz-community/crawl-links#4
describe("same-page anchor links", () => {
  const heading = h2(slugHeading("监听 127.0.0.1（推荐）"), "监听 127.0.0.1（推荐）");

  it("slugs an anchor written as the heading's text like the heading's id", () => {
    const [, raw, encoded] = run([
      heading,
      a("#监听 127.0.0.1（推荐）"),
      a("#%E7%9B%91%E5%90%AC%20127.0.0.1%EF%BC%88%E6%8E%A8%E8%8D%90%EF%BC%89"),
    ]);
    expect(hrefOf(raw!)).toBe("#监听-127001推荐");
    expect(hrefOf(encoded!)).toBe("#监听-127001推荐");
  });

  it("leaves anchors naming an existing id, or no id, unchanged", () => {
    const [, exact, unknown] = run([heading, a("#监听-127001推荐"), a("#Added%20Later")]);
    expect(hrefOf(exact!)).toBe("#监听-127001推荐");
    expect(hrefOf(unknown!)).toBe("#Added%20Later");
  });

  it("points a block reference at its block", () => {
    const block: Element = {
      type: "element",
      tagName: "p",
      properties: { id: "abc" },
      children: [],
    };
    const [, link] = run([block, a("#^abc")]);
    expect(hrefOf(link!)).toBe("#abc");
  });
});

// quartz-community/crawl-links#10
describe("links to another note's heading", () => {
  it("slug Obsidian's anchor to the heading's alias id", () => {
    // Obsidian links `## Colon:unspaced` as `#Colon unspaced`; heading producers add
    // slugHeading(obsidianHeadingAnchor(text)) as an alias id
    const alias = slugHeading(obsidianHeadingAnchor("Colon:unspaced"));
    for (const strategy of ["absolute", "relative", "shortest"] as const) {
      const [link] = run([a("b#Colon unspaced")], { markdownLinkResolution: strategy });
      expect(String(hrefOf(link!)).endsWith(`b#${alias}`)).toBe(true);
    }
  });
});
