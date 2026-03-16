import { build, context } from "esbuild";

const watch = process.argv.includes("--watch");

const config = {
  entryPoints: ["src/client/index.tsx"],
  bundle: true,
  format: "esm",
  splitting: false,
  platform: "browser",
  target: ["es2022"],
  outfile: "public/app.js",
  sourcemap: true,
  minify: !watch,
  jsx: "automatic",
  loader: {
    ".css": "css"
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify(watch ? "development" : "production")
  },
  legalComments: "none"
};

if (watch) {
  const ctx = await context(config);
  await ctx.watch();
  console.log("Watching UI bundle...");
} else {
  await build(config);
}
