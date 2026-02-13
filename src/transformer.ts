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
}

const defaultOptions: CrawlLinksOptions = {
  markdownLinkResolution: "absolute",
  prettyLinks: true,
  openLinksInNewTab: false,
  lazyLoad: false,
  externalLinkIcon: true,
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
                classes.push(isExternal ? "external" : "internal");

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

                // don't process external links or intra-document anchors
                const isInternal = !(
                  isAbsoluteUrlWithOptions(dest, { httpOnly: false }) || dest.startsWith("#")
                );
                if (isInternal) {
                  dest = node.properties.href = transformLink(fileSlug, dest, transformOptions);

                  // url.resolve is considered legacy
                  // WHATWG equivalent https://nodejs.dev/en/api/v18/url/#urlresolvefrom-to
                  const url = new URL(dest, "https://base.com/" + stripSlashes(curSlug, true));
                  const canonicalDest = url.pathname;
                  let [destCanonical, _destAnchor] = splitAnchor(canonicalDest);
                  if (destCanonical.endsWith("/")) {
                    destCanonical += "index";
                  }

                  // need to decodeURIComponent here as WHATWG URL percent-encodes everything
                  const full = decodeURIComponent(stripSlashes(destCanonical, true)) as FullSlug;
                  const simple = simplifySlug(full);
                  outgoing.add(simple);
                  node.properties["data-slug"] = full;
                }

                // rewrite link internals if prettylinks is on
                if (opts.prettyLinks && isInternal && node.children.length === 1) {
                  const textChild = node.children[0] as Text | undefined;
                  if (textChild?.type === "text" && !textChild.value.startsWith("#")) {
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

            file.data.links = [...outgoing];
          };
        },
      ];
    },
  };
};

declare module "vfile" {
  interface DataMap {
    links: SimpleSlug[];
  }
}
