# Dynamic Workers Playground

An opinionated get-started example that rebuilds the original `workers-builder` basic playground on top of [`@cloudflare/worker-bundler`](https://www.npmjs.com/package/@cloudflare/worker-bundler) and gives it a Kumo-flavored UI.

It is designed to show dynamic workers in action quickly:

- write or import worker code
- bundle it at runtime with `worker-bundler`
- execute it through a `WorkerLoader` binding
- inspect response timing, logs, and bundled modules

## Deploy to Cloudflare

Replace `YOUR_GITHUB_USERNAME` after you publish this repo, then the button will work as-is.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/YOUR_GITHUB_USERNAME/dynamic-workers-playground)

## Why this example exists

This project is intentionally not a full IDE. The goal is to keep the interface simple enough that the dynamic worker lifecycle is the star:

- `@cloudflare/worker-bundler` bundles source files and npm dependencies at runtime
- the host worker uses a `worker_loaders` binding to boot generated workers
- a tail worker plus Durable Object captures console output for the UI
- the frontend uses Kumo components and styling for a polished default experience

## Local development

```bash
npm install
npm run dev
```

That command:

- bundles the React + Kumo UI into `public/app.js` and `public/app.css`
- generates Wrangler types
- starts local development with `wrangler dev`

## Project structure

```txt
public/
  index.html     Static shell
  app.js         Bundled frontend
  app.css        Bundled Kumo + custom styles
src/
  index.ts       Host worker and API routes
  github.ts      GitHub import helper
  logging.ts     Tail worker + Durable Object logging
  client/        Frontend source used to build public assets
```

## Important note

`worker_loaders` is currently a closed beta capability. This example is meant for environments where that binding is already available.
