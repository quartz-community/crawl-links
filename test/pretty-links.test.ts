import { describe, it, expect } from "vitest";
import type { Root, Element, Text } from "hast";
import { VFile } from "vfile";
import type { BuildCtx } from "@quartz-community/types";
import type { FullSlug } from "@quartz-community/utils";
import { CrawlLinks } from "../src/transformer";
import type { CrawlLinksOptions } from "../src/transformer";

// A bare link (no alias) has display text equal to its href; pass a second
// argument to model an explicit alias whose text differs from the href.
function makeAnchorTree(href: string, text = href): Root {
  const link: Element = {
    type: "element",
    tagName: "a",
    properties: { href },
    children: [{ type: "text", value: text }],
  };
  return { type: "root", children: [link] };
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

function textOf(el: Element): string {
  const child = el.children[0] as Text | undefined;
  return child?.type === "text" ? child.value : "";
}

function hasClass(el: Element, className: string): boolean {
  const classes = (el.properties?.className ?? []) as string[];
  return classes.includes(className);
}

const opts: Partial<CrawlLinksOptions> = { markdownLinkResolution: "absolute" };
const fileSlug = "index";

describe("prettyLinks - bare links keep folder stripping (intended behaviour)", () => {
  const allSlugs = ["a/b/c", "x/y/z/note", "note"];

  it("strips folders from a bare multi-segment path", () => {
    const link = runTransform(makeAnchorTree("a/b/c"), opts, allSlugs, fileSlug);
    expect(textOf(link)).toBe("c");
    expect(hasClass(link, "alias")).toBe(false);
  });

  it("strips deep folders from a bare path", () => {
    const link = runTransform(makeAnchorTree("x/y/z/note"), opts, allSlugs, fileSlug);
    expect(textOf(link)).toBe("note");
  });

  it("leaves a bare single-segment link unchanged", () => {
    const link = runTransform(makeAnchorTree("note"), opts, allSlugs, fileSlug);
    expect(textOf(link)).toBe("note");
  });
});

describe("prettyLinks - explicit aliases are never truncated", () => {
  const allSlugs = ["a/b/c", "my-note", "guide"];

  it("keeps a plain alias intact and tags it with the alias class", () => {
    const link = runTransform(makeAnchorTree("a/b/c", "My Alias"), opts, allSlugs, fileSlug);
    expect(textOf(link)).toBe("My Alias");
    expect(hasClass(link, "alias")).toBe(true);
  });

  // Regression for jackyzha0/quartz#2214 and #326: a slash inside an explicit
  // alias must not be folder-stripped down to its last segment.
  it("keeps an alias that contains a slash intact", () => {
    const link = runTransform(makeAnchorTree("my-note", "Part 1/Part 2"), opts, allSlugs, fileSlug);
    expect(textOf(link)).toBe("Part 1/Part 2");
    expect(hasClass(link, "alias")).toBe(true);
  });

  it("keeps a slash-bearing alias on a heading link intact", () => {
    // e.g. [[Guide#Setup|Intro/Setup]]
    const link = runTransform(
      makeAnchorTree("guide#setup", "Intro/Setup"),
      opts,
      allSlugs,
      fileSlug,
    );
    expect(textOf(link)).toBe("Intro/Setup");
    expect(hasClass(link, "alias")).toBe(true);
  });

  // The reported bug shape ([[folder/note|Part 1/Part 2]]): both the href and
  // the alias contain slashes; the alias must survive intact.
  it("keeps an alias intact when both the href and the alias contain slashes", () => {
    const link = runTransform(
      makeAnchorTree("folder/note", "Part 1/Part 2"),
      opts,
      allSlugs,
      fileSlug,
    );
    expect(textOf(link)).toBe("Part 1/Part 2");
    expect(hasClass(link, "alias")).toBe(true);
  });
});

describe("prettyLinks - disabled leaves text alone", () => {
  it("does not strip folders from a bare path when prettyLinks is false", () => {
    const link = runTransform(
      makeAnchorTree("a/b/c"),
      { prettyLinks: false, markdownLinkResolution: "absolute" },
      ["a/b/c"],
      fileSlug,
    );
    expect(textOf(link)).toBe("a/b/c");
  });
});

describe("prettyLinks - scope", () => {
  it("does not basename external link text", () => {
    const link = runTransform(makeAnchorTree("https://example.com/a/b/c"), opts, [], fileSlug);
    expect(textOf(link)).toBe("https://example.com/a/b/c");
  });

  it("does not basename intra-document anchor text", () => {
    const link = runTransform(makeAnchorTree("#section"), opts, [], fileSlug);
    expect(textOf(link)).toBe("#section");
  });
});
