import { describe, it, expect } from "vitest";
import type { Root, Element, Text } from "hast";
import { VFile } from "vfile";
import type { BuildCtx } from "@quartz-community/types";
import type { FullSlug } from "@quartz-community/utils";
import { CrawlLinks } from "../src/transformer";
import type { CrawlLinksOptions } from "../src/transformer";

// A bare link's display text is its own path, so text defaults to the href.
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

describe("prettyLinks - bare links", () => {
  it("strips folders from a bare path", () => {
    const link = runTransform(makeAnchorTree("a/b/c"), opts, ["a/b/c"], fileSlug);
    expect(textOf(link)).toBe("c");
    expect(hasClass(link, "alias")).toBe(false);
  });

  it("leaves text alone when prettyLinks is off", () => {
    const link = runTransform(
      makeAnchorTree("a/b/c"),
      { ...opts, prettyLinks: false },
      ["a/b/c"],
      fileSlug,
    );
    expect(textOf(link)).toBe("a/b/c");
  });
});

describe("prettyLinks - explicit aliases", () => {
  it("keeps an alias that contains a slash intact", () => {
    const link = runTransform(
      makeAnchorTree("folder/note", "Part 1/Part 2"),
      opts,
      ["folder/note"],
      fileSlug,
    );
    expect(textOf(link)).toBe("Part 1/Part 2");
    expect(hasClass(link, "alias")).toBe(true);
  });
});

// The Markdown-to-HTML step percent-encodes the href, so [[Folder/Name With Space]]
// reaches this plugin with text "Folder/Name With Space" and an encoded href.
describe("prettyLinks - percent-encoded hrefs", () => {
  const allSlugs = ["folder/name-with-space", "ordner/übersicht"];

  it("strips folders from a bare link whose path has a space", () => {
    const link = runTransform(
      makeAnchorTree("Folder/Name%20With%20Space", "Folder/Name With Space"),
      opts,
      allSlugs,
      fileSlug,
    );
    expect(textOf(link)).toBe("Name With Space");
    expect(hasClass(link, "alias")).toBe(false);
  });

  it("strips folders from a bare link whose path has a non-ASCII letter", () => {
    const link = runTransform(
      makeAnchorTree("Ordner/%C3%9Cbersicht", "Ordner/Übersicht"),
      opts,
      allSlugs,
      fileSlug,
    );
    expect(textOf(link)).toBe("Übersicht");
    expect(hasClass(link, "alias")).toBe(false);
  });

  it("keeps an explicit alias on an encoded href intact", () => {
    const link = runTransform(
      makeAnchorTree("Folder/Name%20With%20Space", "Part 1/Part 2"),
      opts,
      allSlugs,
      fileSlug,
    );
    expect(textOf(link)).toBe("Part 1/Part 2");
    expect(hasClass(link, "alias")).toBe(true);
  });

  it("still treats text that matches the raw href as bare", () => {
    const link = runTransform(makeAnchorTree("folder/a%20b"), opts, ["folder/a-b"], fileSlug);
    expect(textOf(link)).toBe("a%20b");
    expect(hasClass(link, "alias")).toBe(false);
  });

  it("does not throw on an external link with a malformed escape", () => {
    const link = runTransform(
      makeAnchorTree("https://example.com/bad%E0%A4%A", "Example"),
      { ...opts, externalLinkIcon: false },
      [],
      fileSlug,
    );
    expect(textOf(link)).toBe("Example");
    expect(hasClass(link, "alias")).toBe(true);
  });
});
