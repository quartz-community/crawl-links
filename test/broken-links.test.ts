import { describe, it, expect } from "vitest";
import type { Root, Element } from "hast";
import { VFile } from "vfile";
import type { BuildCtx } from "@quartz-community/types";
import type { FullSlug } from "@quartz-community/utils";
import { CrawlLinks } from "../src/transformer";
import type { CrawlLinksOptions } from "../src/transformer";

function makeAnchorTree(href: string, text = "link"): Root {
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

function hasClass(el: Element, className: string): boolean {
  const classes = (el.properties?.className ?? []) as string[];
  return classes.includes(className);
}

describe("disableBrokenWikilinks - default (on)", () => {
  it("adds 'broken' to unresolved internal links by default, as Obsidian marks them", () => {
    const link = runTransform(makeAnchorTree("missing"), {}, [], "test/page");
    expect(hasClass(link, "internal")).toBe(true);
    expect(hasClass(link, "broken")).toBe(true);
  });

  it("leaves resolved links alone by default", () => {
    const link = runTransform(makeAnchorTree("other"), {}, ["other"], "test/page");
    expect(hasClass(link, "broken")).toBe(false);
  });

  it("does not add 'broken' class to unresolved internal links when option is off", () => {
    const tree = makeAnchorTree("missing");
    const link = runTransform(tree, { disableBrokenWikilinks: false }, [], "test/page");
    expect(hasClass(link, "internal")).toBe(true);
    expect(hasClass(link, "broken")).toBe(false);
  });
});

describe("disableBrokenWikilinks - shortest strategy", () => {
  const opts: Partial<CrawlLinksOptions> = {
    disableBrokenWikilinks: true,
    markdownLinkResolution: "shortest",
  };
  const allSlugs = ["a/b/c", "a/b/d", "a/b/index", "e/f", "e/g/h", "index"];
  const fileSlug = "a/b/c";

  it("does not mark a bare filename that resolves via basename as broken", () => {
    const tree = makeAnchorTree("d");
    const link = runTransform(tree, opts, allSlugs, fileSlug);
    expect(hasClass(link, "broken")).toBe(false);
  });

  it("does not mark a multi-segment partial path that resolves via suffix as broken", () => {
    const tree = makeAnchorTree("g/h");
    const link = runTransform(tree, opts, allSlugs, fileSlug);
    expect(hasClass(link, "broken")).toBe(false);
  });

  it("does not mark an absolute path that exists in allSlugs as broken", () => {
    const tree = makeAnchorTree("e/f");
    const link = runTransform(tree, opts, allSlugs, fileSlug);
    expect(hasClass(link, "broken")).toBe(false);
  });

  it("marks a completely missing wikilink as broken", () => {
    const tree = makeAnchorTree("does-not-exist");
    const link = runTransform(tree, opts, allSlugs, fileSlug);
    expect(hasClass(link, "internal")).toBe(true);
    expect(hasClass(link, "broken")).toBe(true);
  });

  it("marks a missing multi-segment path as broken", () => {
    const tree = makeAnchorTree("x/y/z");
    const link = runTransform(tree, opts, allSlugs, fileSlug);
    expect(hasClass(link, "broken")).toBe(true);
  });
});

describe("disableBrokenWikilinks - absolute strategy", () => {
  const opts: Partial<CrawlLinksOptions> = {
    disableBrokenWikilinks: true,
    markdownLinkResolution: "absolute",
  };
  const allSlugs = ["a/b/c", "a/b/d", "e/f"];
  const fileSlug = "a/b/c";

  it("marks a bare filename as broken under absolute resolution", () => {
    const tree = makeAnchorTree("d");
    const link = runTransform(tree, opts, allSlugs, fileSlug);
    expect(hasClass(link, "broken")).toBe(true);
  });

  it("does not mark a valid absolute path as broken", () => {
    const tree = makeAnchorTree("a/b/d");
    const link = runTransform(tree, opts, allSlugs, fileSlug);
    expect(hasClass(link, "broken")).toBe(false);
  });

  it("marks a missing absolute path as broken", () => {
    const tree = makeAnchorTree("nowhere/at/all");
    const link = runTransform(tree, opts, allSlugs, fileSlug);
    expect(hasClass(link, "broken")).toBe(true);
  });
});

describe("disableBrokenWikilinks - relative strategy", () => {
  const opts: Partial<CrawlLinksOptions> = {
    disableBrokenWikilinks: true,
    markdownLinkResolution: "relative",
  };
  const allSlugs = ["a/b/c", "a/b/d", "a/sibling"];
  const fileSlug = "a/b/c";

  it("does not mark a valid same-folder sibling as broken", () => {
    const tree = makeAnchorTree("d");
    const link = runTransform(tree, opts, allSlugs, fileSlug);
    expect(hasClass(link, "broken")).toBe(false);
  });

  it("does not mark a valid parent-folder link via ../ as broken", () => {
    const tree = makeAnchorTree("../sibling");
    const link = runTransform(tree, opts, allSlugs, fileSlug);
    expect(hasClass(link, "broken")).toBe(false);
  });

  it("marks an unresolved relative link as broken", () => {
    const tree = makeAnchorTree("../nonexistent");
    const link = runTransform(tree, opts, allSlugs, fileSlug);
    expect(hasClass(link, "broken")).toBe(true);
  });
});

describe("disableBrokenWikilinks - scope", () => {
  const opts: Partial<CrawlLinksOptions> = {
    disableBrokenWikilinks: true,
    markdownLinkResolution: "shortest",
  };

  it("does not mark external links as broken", () => {
    const tree = makeAnchorTree("https://example.com");
    const link = runTransform(tree, opts, [], "test/page");
    expect(hasClass(link, "external")).toBe(true);
    expect(hasClass(link, "broken")).toBe(false);
  });

  it("does not mark intra-document anchor links as broken", () => {
    const tree = makeAnchorTree("#section");
    const link = runTransform(tree, opts, [], "test/page");
    expect(hasClass(link, "broken")).toBe(false);
  });
});

describe("disableBrokenWikilinks - empty allSlugs", () => {
  it("marks every internal link as broken when allSlugs is empty", () => {
    const tree = makeAnchorTree("any-page");
    const link = runTransform(
      tree,
      { disableBrokenWikilinks: true, markdownLinkResolution: "shortest" },
      [],
      "test/page",
    );
    expect(hasClass(link, "broken")).toBe(true);
  });
});
