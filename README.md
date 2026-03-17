# Dynamic Workers Playground

This is a playground for executing Dynamic Workers.

You can use it to:

- write or import worker code
- bundle it at runtime with [`@cloudflare/worker-bundler`](https://www.npmjs.com/package/@cloudflare/worker-bundler)
- run it through a dynamic worker loader
- see real-time responses, logs, timing, and bundle details

## Deploy to Cloudflare

Use the button below to deploy directly from this GitHub repository.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/dinasaur404/dynamic-workers-playground)

## What it demonstrates

- **Runtime bundling** -- `@cloudflare/worker-bundler` resolves npm dependencies and bundles source files entirely at runtime, inside a Worker
- **Dynamic execution** -- bundled modules are loaded and executed on-demand through a `worker_loaders` binding, with automatic caching when source has not changed
- **Log capture pipeline** -- a Tail Worker forwards `console.*` output from dynamically loaded workers to a Durable Object, which streams logs back to the caller in real time
- **Execution timing** -- granular build/load/run breakdown with cold vs. warm detection, showing the full Dynamic Worker lifecycle
- **GitHub import** -- pull source files from any public repo to bundle and run, demonstrating that `worker-bundler` handles real-world code with dependencies

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
