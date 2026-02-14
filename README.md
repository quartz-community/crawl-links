# @quartz-community/crawl-links

Processes and resolves internal and external links, tracks outgoing links, and optionally adds external link icons.

## Installation

```bash
npx quartz plugin add github:quartz-community/crawl-links
```

## Usage

```ts
// quartz.config.ts
import * as ExternalPlugin from "./.quartz/plugins";

const config: QuartzConfig = {
  plugins: {
    transformers: [ExternalPlugin.CrawlLinks()],
  },
};
```

## Configuration

| Option                   | Type                                     | Default      | Description                           |
| ------------------------ | ---------------------------------------- | ------------ | ------------------------------------- |
| `markdownLinkResolution` | `"absolute" \| "relative" \| "shortest"` | `"absolute"` | How to resolve internal links.        |
| `prettyLinks`            | `boolean`                                | `true`       | Whether to use pretty links.          |
| `openLinksInNewTab`      | `boolean`                                | `false`      | Whether to open links in a new tab.   |
| `lazyLoad`               | `boolean`                                | `false`      | Whether to lazy load links.           |
| `externalLinkIcon`       | `boolean`                                | `true`       | Whether to add an external link icon. |

## Documentation

See the [Quartz documentation](https://quartz.jzhao.xyz/) for more information.

## License

MIT
