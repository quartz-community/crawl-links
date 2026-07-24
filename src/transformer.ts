import type { QuartzTransformerPlugin, BuildCtx } from "@quartz-community/types";
import type { FullSlug, RelativeURL, SimpleSlug, TransformOptions } from "@quartz-community/utils";
import { stripSlashes, simplifySlug, splitAnchor, transformLink } from "@quartz-community/utils";
import path from "path";
import { visit } from "unist-util-visit";
import isAbsoluteUrl from "is-absolute-url";
import type { Root, Element, Text } from "hast";
import type { VFile } from "vfile";

export interface CrawlLinksOptions {
  /** How to resolve Markdown paths */
  markdownLinkResolution: TransformOptions["strategy"];
  /** Strips folders from a link so that it looks nice */
  prettyLinks: boolean;
  openLinksInNewTab: boolean;
  lazyLoad: boolean;
  externalLinkIcon: boolean;
  /**
   * When `true`, internal links whose resolved slug is not present in
   * `ctx.allSlugs` gain a `broken` CSS class (alongside `internal`) so
   * broken links can be styled distinctly. Applies to both wikilinks
   * (after they've been converted to `<a>` elements by
   * ObsidianFlavoredMarkdown) and markdown links, since both are
   * indistinguishable `<a>` nodes at this phase of the pipeline.
   */
  disableBrokenWikilinks: boolean;
}

const defaultOptions: CrawlLinksOptions = {
  markdownLinkResolution: "absolute",
  prettyLinks: true,
  openLinksInNewTab: false,
  lazyLoad: false,
  externalLinkIcon: true,
  disableBrokenWikilinks: false,
};

const isAbsoluteUrlWithOptions = isAbsoluteUrl as (
  url: string,
  options?: { httpOnly?: boolean },
) => boolean;

export const CrawlLinks: QuartzTransformerPlugin<Partial<CrawlLinksOptions>> = (
  userOpts?: Partial<CrawlLinksOptions>,
) => {
  const opts = { ...defaultOptions, ...userOpts };
  return {
    name: "LinkProcessing",
    htmlPlugins(ctx: BuildCtx) {
      return [
        () => {
          return (tree: Root, file: VFile) => {
            const fileSlug = file.data.slug as FullSlug;
            const curSlug = simplifySlug(fileSlug);
            const outgoing: Set<SimpleSlug> = new Set();

            const transformOptions: TransformOptions = {
              strategy: opts.markdownLinkResolution,
              allSlugs: ctx.allSlugs,
            };

            visit(tree, "element", (node: Element) => {
              // rewrite all links
              if (
                node.tagName === "a" &&
                node.properties &&
                typeof node.properties.href === "string"
              ) {
                let dest = node.properties.href as RelativeURL;
                const classes = (node.properties.className ?? []) as string[];
                const isExternal = isAbsoluteUrlWithOptions(dest, { httpOnly: false });
                if (isExternal) {
                  classes.push("external", "external-link");
                } else {
                  classes.push("internal", "internal-link");
                }

                if (isExternal && opts.externalLinkIcon) {
                  node.children.push({
                    type: "element",
                    tagName: "svg",
                    properties: {
                      "aria-hidden": "true",
                      class: "external-icon",
                      style: "max-width:0.8em;max-height:0.8em",
                      viewBox: "0 0 512 512",
                    },
                    children: [
                      {
                        type: "element",
                        tagName: "path",
                        properties: {
                          d: "M320 0H288V64h32 82.7L201.4 265.4 178.7 288 224 333.3l22.6-22.6L448 109.3V192v32h64V192 32 0H480 320zM32 32H0V64 480v32H32 456h32V480 352 320H424v32 96H64V96h96 32V32H160 32z",
                        },
                        children: [],
                      },
                    ],
                  });
                }

                // Check if the link has alias text
                const firstChild = node.children[0];
                if (
                  node.children.length === 1 &&
                  firstChild?.type === "text" &&
                  firstChild.value !== dest
                ) {
                  // Add the 'alias' class if the text content is not the same as the href
                  classes.push("alias");
                }
                node.properties.className = classes;

                if (isExternal && opts.openLinksInNewTab) {
                  node.properties.target = "_blank";
                }

                const isInternal = !(
                  isAbsoluteUrlWithOptions(dest, { httpOnly: false }) || dest.startsWith("#")
                );
                if (isInternal) {
                  dest = node.properties.href = transformLink(fileSlug, dest, transformOptions);

                  // url.resolve is considered legacy
                  // WHATWG equivalent https://nodejs.dev/en/api/v18/url/#urlresolvefrom-to
                  const url = new URL(dest, "https://base.com/" + stripSlashes(curSlug, true));
                  const canonicalDest = url.pathname;
                  const [destCanonicalRaw, _destAnchor] = splitAnchor(canonicalDest);
                  let destCanonical = destCanonicalRaw;
                  if (destCanonical.endsWith("/")) {
                    destCanonical += "index";
                  }

                  // need to decodeURIComponent here as WHATWG URL percent-encodes everything
                  const full = decodeURIComponent(stripSlashes(destCanonical, true)) as FullSlug;
                  const simple = simplifySlug(full);
                  outgoing.add(simple);
                  node.properties["data-slug"] = full;

                  if (opts.disableBrokenWikilinks && !ctx.allSlugs.includes(full)) {
                    classes.push("broken");
                    node.properties.className = classes;
                  }
                }

                // rewrite link internals if prettylinks is on
                if (opts.prettyLinks && isInternal && node.children.length === 1) {
                  const hasAlias = classes.includes("alias");
                  const textChild = node.children[0] as Text | undefined;
                  if (textChild?.type === "text" && !textChild.value.startsWith("#") && !hasAlias) {
                    textChild.value = path.basename(textChild.value);
                  }
                }
              }

              // transform all other resources that may use links
              if (
                ["img", "video", "audio", "iframe"].includes(node.tagName) &&
                node.properties &&
                typeof node.properties.src === "string"
              ) {
                if (opts.lazyLoad) {
                  node.properties.loading = "lazy";
                }

                if (!isAbsoluteUrlWithOptions(node.properties.src, { httpOnly: false })) {
                  let dest = node.properties.src as RelativeURL;
                  dest = node.properties.src = transformLink(fileSlug, dest, transformOptions);
                  node.properties.src = dest;
                }
              }
            });

            const frontmatterLinks = (file.data.frontmatterLinks as string[] | undefined) ?? [];
            for (const fmLink of frontmatterLinks) {
              const [targetRaw] = splitAnchor(fmLink);
              if (!targetRaw) continue;
              const dest = transformLink(fileSlug, targetRaw, transformOptions);
              const url = new URL(dest, "https://base.com/" + stripSlashes(curSlug, true));
              const [canonicalRaw] = splitAnchor(url.pathname);
              let canonical = canonicalRaw;
              if (canonical.endsWith("/")) canonical += "index";
              const full = decodeURIComponent(stripSlashes(canonical, true)) as FullSlug;
              outgoing.add(simplifySlug(full));
            }

            file.data.links = [...outgoing];
          };
        },
      ];
    },
  };
};
