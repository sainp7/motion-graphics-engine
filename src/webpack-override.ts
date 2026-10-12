import type { WebpackOverrideFn } from "@remotion/bundler";

/**
 * Shared by remotion.config.ts (CLI renders, Remotion Studio) and scripts that bundle directly.
 * The package is "type": "module", so webpack treats .js files as strict ESM and demands full
 * import paths. Custom script scenes (videos/<id>/scenes/*.js) import the kit without an
 * extension, like the TypeScript code does, so relax that rule.
 */
export const webpackOverride: WebpackOverrideFn = (config) => ({
  ...config,
  module: {
    ...config.module,
    rules: [...(config.module?.rules ?? []), { test: /\.m?js$/, resolve: { fullySpecified: false } }],
  },
});
