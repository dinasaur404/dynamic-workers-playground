import { FileText, GithubLogo, Monitor, Play, Plus, X } from "@phosphor-icons/react";
import { Button, Checkbox, Dialog, Input, Select, Surface, Textarea } from "@cloudflare/kumo";
import { useMemo, useState } from "react";

type PlaygroundFiles = Record<string, string>;

interface RunResult {
  bundleInfo: {
    mainModule: string;
    modules: string[];
    warnings: string[];
  };
  response: {
    status: number;
    headers: Record<string, string>;
    body: string;
  };
  workerError: {
    message: string;
    stack?: string;
  } | null;
  logs: Array<{
    level: string;
    message: string;
    timestamp: number;
  }>;
  timing: {
    buildTime: number;
    loadTime: number;
    runTime: number;
    totalTime: number;
  };
}

interface GitHubImportResult {
  error?: string;
  files?: PlaygroundFiles;
}

type StatusTone = "idle" | "running" | "success" | "error";

const EXAMPLES: Array<{
  id: string;
  label: string;
  files: PlaygroundFiles;
}> = [
  {
    id: "simple",
    label: "Simple Worker",
    files: {
      "src/index.ts": `export default {
  fetch(request: Request): Response {
    return new Response("Hello from dynamic worker!");
  }
};`,
      "package.json": JSON.stringify({ name: "simple-worker", main: "src/index.ts" }, null, 2)
    }
  },
  {
    id: "multi-file",
    label: "Multi-file Worker",
    files: {
      "src/index.ts": `import { greet } from "./utils";
import { formatDate } from "./helpers/date";

export default {
  fetch(request: Request): Response {
    const message = greet("World");
    const time = formatDate(new Date());
    return new Response(\`${"${message}\\nTime: ${time}"}\`);
  }
};`,
      "src/utils.ts": `export function greet(name: string): string {
  return \`Hello, ${"${name}"}!\`;
}`,
      "src/helpers/date.ts": `export function formatDate(date: Date): string {
  return date.toISOString();
}`,
      "package.json": JSON.stringify({ name: "multi-file-worker", main: "src/index.ts" }, null, 2)
    }
  },
  {
    id: "json-config",
    label: "JSON Config",
    files: {
      "src/index.ts": `import config from "./config.json";

export default {
  fetch(request: Request): Response {
    return new Response(
      JSON.stringify(
        {
          app: config.name,
          version: config.version,
          features: config.features
        },
        null,
        2
      ),
      {
        headers: { "Content-Type": "application/json" }
      }
    );
  }
};`,
      "src/config.json": JSON.stringify(
        {
          name: "My App",
          version: "1.0.0",
          features: ["auth", "api", "webhooks"]
        },
        null,
        2
      ),
      "package.json": JSON.stringify({ name: "config-worker", main: "src/index.ts" }, null, 2)
    }
  },
  {
    id: "with-env",
    label: "With Env Bindings",
    files: {
      "src/index.ts": `interface Env {
  API_KEY: string;
  DEBUG: string;
}

export default {
  fetch(request: Request, env: Env): Response {
    const data = {
      hasApiKey: !!env.API_KEY,
      apiKeyPreview: env.API_KEY ? env.API_KEY.slice(0, 4) + "..." : null,
      debugMode: env.DEBUG === "true"
    };

    return new Response(JSON.stringify(data, null, 2), {
      headers: { "Content-Type": "application/json" }
    });
  }
};`,
      "package.json": JSON.stringify({ name: "env-worker", main: "src/index.ts" }, null, 2)
    }
  },
  {
    id: "api-router",
    label: "API Router",
    files: {
      "src/index.ts": `import { handleUsers } from "./routes/users";
import { handleHealth } from "./routes/health";

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return handleHealth();
    }

    if (url.pathname.startsWith("/users")) {
      return handleUsers(request);
    }

    return new Response(
      JSON.stringify(
        {
          error: "Not Found",
          availableRoutes: ["/health", "/users"]
        },
        null,
        2
      ),
      {
        status: 404,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
};`,
      "src/routes/users.ts": `const users = [
  { id: 1, name: "Alice" },
  { id: 2, name: "Bob" }
];

export function handleUsers(request: Request): Response {
  return new Response(JSON.stringify({ users }), {
    headers: { "Content-Type": "application/json" }
  });
}`,
      "src/routes/health.ts": `export function handleHealth(): Response {
  return new Response(
    JSON.stringify(
      {
        status: "healthy",
        timestamp: new Date().toISOString()
      },
      null,
      2
    ),
    {
      headers: { "Content-Type": "application/json" }
    }
  );
}`,
      "package.json": JSON.stringify({ name: "api-router", main: "src/index.ts" }, null, 2)
    }
  }
];

function snapshotFiles(files: PlaygroundFiles) {
  return JSON.stringify(files);
}

function inferPrimaryFile(files: PlaygroundFiles) {
  return (
    Object.keys(files).find((file) => file === "src/index.ts" || file === "src/index.js") ||
    Object.keys(files).find((file) => file.endsWith(".ts") || file.endsWith(".js")) ||
    Object.keys(files)[0]
  );
}

function prettyBody(body: string) {
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}

function getContentType(headers: Record<string, string>) {
  const match = Object.entries(headers).find(([key]) => key.toLowerCase() === "content-type");
  return match?.[1] ?? "text/plain";
}

function statusClassName(status: StatusTone) {
  if (status === "success") return "success";
  if (status === "error") return "error";
  if (status === "running") return "loading";
  return "idle";
}

function consolePrefix(level: string) {
  if (level === "error") return "x";
  if (level === "warn") return "!";
  return ">";
}

function LayersLogo() {
  return (
    <svg className="brand-logo" viewBox="0 0 48 49" aria-hidden="true">
      <path d="m18.63 37.418-9.645-12.9 9.592-12.533-1.852-2.527L5.917 23.595l-.015 1.808 10.86 14.542z" />
      <path d="M21.997 6.503h-3.712l13.387 18.3-13.072 17.7h3.735L35.4 24.81z" />
      <path d="M29.175 6.503h-3.758l13.598 18.082-13.598 17.918h3.765l12.908-17.01v-1.808z" />
    </svg>
  );
}

export function App() {
  const initialExample = EXAMPLES[0];
  const [files, setFiles] = useState<PlaygroundFiles>({ ...initialExample.files });
  const [currentFile, setCurrentFile] = useState(inferPrimaryFile(initialExample.files));
  const [bundle, setBundle] = useState(true);
  const [minify, setMinify] = useState(false);
  const [status, setStatus] = useState<{ tone: StatusTone; label: string }>({ tone: "idle", label: "Ready" });
  const [workerVersion, setWorkerVersion] = useState(0);
  const [lastSnapshot, setLastSnapshot] = useState<string | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<{ message: string; stack?: string } | null>(null);
  const [running, setRunning] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exampleValue, setExampleValue] = useState<string | null>(null);
  const [addFileOpen, setAddFileOpen] = useState(false);
  const [githubOpen, setGithubOpen] = useState(false);
  const [addFileName, setAddFileName] = useState("");
  const [githubUrl, setGitHubUrl] = useState("");

  const orderedFiles = useMemo(() => Object.keys(files), [files]);
  const currentValue = currentFile ? files[currentFile] ?? "" : "";

  function applyFiles(nextFiles: PlaygroundFiles) {
    setFiles(nextFiles);
    setCurrentFile(inferPrimaryFile(nextFiles));
    setResult(null);
    setError(null);
    setStatus({ tone: "idle", label: "Ready" });
  }

  function handleExampleChange(exampleId: string) {
    const example = EXAMPLES.find((item) => item.id === exampleId);
    if (!example) return;
    applyFiles({ ...example.files });
    setExampleValue(null);
  }

  function updateCurrentFile(value: string) {
    if (!currentFile) return;
    setFiles((prev) => ({ ...prev, [currentFile]: value }));
  }

  function handleAddFile() {
    const filename = addFileName.trim();
    if (!filename) return;
    if (files[filename]) {
      window.alert("File already exists");
      return;
    }

    const nextFiles = {
      ...files,
      [filename]: filename.endsWith(".json") ? "{}" : ""
    };

    setFiles(nextFiles);
    setCurrentFile(filename);
    setAddFileName("");
    setAddFileOpen(false);
  }

  function removeFile(filename: string) {
    if (Object.keys(files).length <= 1) {
      window.alert("Cannot delete the last file");
      return;
    }

    const nextFiles = { ...files };
    delete nextFiles[filename];
    setFiles(nextFiles);

    if (currentFile === filename) {
      setCurrentFile(Object.keys(nextFiles)[0]);
    }
  }

  function formatCurrentFile() {
    if (!currentFile || !currentFile.endsWith(".json")) {
      return;
    }

    try {
      const parsed = JSON.parse(currentValue);
      updateCurrentFile(JSON.stringify(parsed, null, 2));
    } catch {
      // Ignore invalid JSON formatting requests.
    }
  }

  async function importFromGitHub() {
    const url = githubUrl.trim();

    if (!url) {
      window.alert("Please enter a GitHub URL");
      return;
    }

    if (!url.startsWith("https://github.com/")) {
      window.alert("Please enter a valid GitHub URL (https://github.com/...)");
      return;
    }

    setImporting(true);
    setStatus({ tone: "running", label: "Importing from GitHub..." });

    try {
      const response = await fetch("/api/github", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url })
      });

      const rawData: unknown = await response.json();
      const data = rawData as GitHubImportResult;
      if (!response.ok || data.error) {
        throw new Error(data.error || "GitHub import failed.");
      }

      const importedFiles = data.files ?? {};
      if (!importedFiles["package.json"]) {
        const mainFile =
          Object.keys(importedFiles).find(
            (file) =>
              file === "src/index.ts" ||
              file === "src/index.js" ||
              file === "index.ts" ||
              file === "index.js"
          ) || Object.keys(importedFiles).find((file) => file.endsWith(".ts") || file.endsWith(".js"));

        if (mainFile) {
          importedFiles["package.json"] = JSON.stringify(
            { name: "imported-worker", main: mainFile },
            null,
            2
          );
        }
      }

      applyFiles(importedFiles);
      setGitHubUrl("");
      setGithubOpen(false);
      setStatus({
        tone: "success",
        label: `Imported ${Object.keys(importedFiles).length} file${Object.keys(importedFiles).length === 1 ? "" : "s"}`
      });
    } catch (importError) {
      setStatus({ tone: "error", label: "Import failed" });
      window.alert(importError instanceof Error ? importError.message : String(importError));
    } finally {
      setImporting(false);
    }
  }

  async function runWorker() {
    setRunning(true);
    setError(null);
    setStatus({ tone: "running", label: "Bundling..." });

    try {
      const nextSnapshot = snapshotFiles(files);
      const nextVersion = nextSnapshot === lastSnapshot ? workerVersion : workerVersion + 1;

      if (nextVersion !== workerVersion) {
        setWorkerVersion(nextVersion);
        setLastSnapshot(nextSnapshot);
      }

      const response = await fetch("/api/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          files,
          version: nextVersion,
          options: { bundle, minify }
        })
      });

      const rawPayload: unknown = await response.json();
      const payload = rawPayload as RunResult & { error?: string; stack?: string };
      if (!response.ok || payload.error) {
        throw new Error(payload.error || "Failed to run worker.");
      }

      setResult(payload);

      if (payload.workerError) {
        setStatus({ tone: "error", label: "Runtime Error" });
      } else {
        setStatus({ tone: "success", label: "Success" });
      }
    } catch (runError) {
      const nextError = {
        message: runError instanceof Error ? runError.message : String(runError),
        stack: runError instanceof Error ? runError.stack : undefined
      };

      setResult(null);
      setError(nextError);
      setStatus({ tone: "error", label: "Bundle Error" });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="app">
      <main className="container">
        <header className="page-header">
          <div className="brand-lockup">
            <LayersLogo />
            <div>
              <h1 className="page-title">Dynamic Workers Playground</h1>
              <p className="page-subtitle">Build and run Workers dynamically from source code</p>
            </div>
          </div>

          <div className="status" aria-live="polite">
            <span className={`status-dot ${statusClassName(status.tone)}`} />
            <span>{status.label}</span>
          </div>
        </header>

        <div className="main-grid">
          <Surface className="panel">
            <div className="panel-header">
              <div className="panel-title">
                <FileText size={16} />
                <span>Source Files</span>
              </div>

              <div className="header-actions">
                <Select
                  aria-label="Load example"
                  className="example-select"
                  placeholder="Load Example..."
                  value={exampleValue as never}
                  onValueChange={(value) => {
                    if (value) {
                      handleExampleChange(String(value));
                    }
                  }}
                >
                  {EXAMPLES.map((example) => (
                    <Select.Option key={example.id} value={example.id}>
                      {example.label}
                    </Select.Option>
                  ))}
                </Select>

                <Button className="github-button" variant="secondary" onClick={() => setGithubOpen(true)}>
                  <GithubLogo size={16} weight="fill" />
                  Import from GitHub
                </Button>
              </div>
            </div>

            <div className="file-tabs">
              {orderedFiles.map((filename) => (
                <button
                  key={filename}
                  className={`file-tab${filename === currentFile ? " active" : ""}`}
                  type="button"
                  onClick={() => setCurrentFile(filename)}
                >
                  <span>{filename}</span>
                  {filename !== "package.json" ? (
                    <span
                      className="file-tab-close"
                      onClick={(event) => {
                        event.stopPropagation();
                        removeFile(filename);
                      }}
                    >
                      x
                    </span>
                  ) : null}
                </button>
              ))}

              <button className="add-file-button" type="button" onClick={() => setAddFileOpen(true)} aria-label="Add new file">
                <Plus size={14} weight="bold" />
              </button>
            </div>

            <div className="editor-wrapper">
              <Textarea
                aria-label="Worker source code"
                className="code-editor"
                spellCheck={false}
                placeholder="Select a file or add a new one..."
                value={currentValue}
                onChange={(event) => updateCurrentFile(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Tab") return;
                  event.preventDefault();
                  const target = event.currentTarget;
                  const start = target.selectionStart;
                  const end = target.selectionEnd;
                  const nextValue = `${currentValue.slice(0, start)}  ${currentValue.slice(end)}`;
                  updateCurrentFile(nextValue);
                  queueMicrotask(() => {
                    target.selectionStart = start + 2;
                    target.selectionEnd = start + 2;
                  });
                }}
              />
            </div>

            <div className="controls">
              <div className="controls-actions">
                <Button className="run-button" variant="primary" disabled={running} onClick={runWorker}>
                  <Play size={14} weight="fill" />
                  {running ? "Running..." : "Run Worker"}
                </Button>

                <Button variant="secondary" onClick={formatCurrentFile}>
                  Format
                </Button>
              </div>

              <div className="controls-options">
                <Checkbox label="Bundle" checked={bundle} onCheckedChange={(checked) => setBundle(Boolean(checked))} />
                <Checkbox label="Minify" checked={minify} onCheckedChange={(checked) => setMinify(Boolean(checked))} />
              </div>
            </div>
          </Surface>

          <Surface className="panel output-panel">
            <div className="panel-header">
              <div className="panel-title">
                <Monitor size={16} />
                <span>Output</span>
              </div>
            </div>

            <div className="panel-content">
              {error ? (
                <div className="output-section">
                  <div className="output-label">Error</div>
                  <pre className="output-content error-text">{error.message}</pre>
                  {error.stack ? <pre className="output-content error-text subdued-stack">{error.stack}</pre> : null}
                </div>
              ) : null}

              {!error && !result ? (
                <div className="empty-state">
                  <Play size={48} />
                  <p>Click "Run Worker" to bundle and execute your code</p>
                </div>
              ) : null}

              {!error && result ? (
                <>
                  <div className="output-section">
                    <div className="output-label">
                      {result.workerError ? "Worker Error" : `Response (${result.response.status})`}
                    </div>

                    {result.workerError ? (
                      <>
                        <pre className="output-content error-text">{result.workerError.message}</pre>
                        {result.workerError.stack ? (
                          <pre className="output-content error-text subdued-stack">{result.workerError.stack}</pre>
                        ) : null}
                      </>
                    ) : (
                      <div className="response-preview">
                        <div className="response-headers">Content-Type: {getContentType(result.response.headers)}</div>
                        <pre className="output-content success-text">{prettyBody(result.response.body)}</pre>
                      </div>
                    )}
                  </div>

                  <div className="output-section">
                    <div className="output-label">
                      Console{result.logs.length ? ` (${result.logs.length} log${result.logs.length === 1 ? "" : "s"})` : ""}
                    </div>
                    <div className="console-output">
                      {result.logs.length ? (
                        result.logs.map((log, index) => (
                          <div key={`${log.timestamp}-${index}`} className={`console-line ${log.level === "error" ? "error" : log.level === "warn" ? "warning" : ""}`}>
                            <span className="console-prefix">{consolePrefix(log.level)}</span>
                            <span>{log.message}</span>
                          </div>
                        ))
                      ) : (
                        <div className="console-empty">No console output. Use console.log() in your worker to see logs here.</div>
                      )}
                    </div>
                  </div>

                  <div className="output-section">
                    <div className="output-label">Timing ({result.timing.loadTime > 0 ? "cold" : "warm"})</div>
                    <div className="output-content timing-grid">
                      <div>
                        <strong>Build:</strong> {result.timing.buildTime}ms
                      </div>
                      <div>
                        <strong>Load:</strong> {result.timing.loadTime}ms
                      </div>
                      <div>
                        <strong>Run:</strong> {result.timing.runTime}ms
                      </div>
                      <div>
                        <strong>Total:</strong> {result.timing.totalTime}ms
                      </div>
                    </div>
                  </div>

                  <div className="output-section">
                    <div className="output-label">Bundle Info</div>
                    <div className="output-content bundle-stack">
                      <div>
                        <strong>Main Module:</strong> {result.bundleInfo.mainModule}
                      </div>

                      <div className="bundle-group">
                        <div className="output-label inline-label">Modules ({result.bundleInfo.modules.length})</div>
                        <div className="modules-list">
                          {result.bundleInfo.modules.map((moduleId) => (
                            <span key={moduleId} className="module-badge">
                              {moduleId}
                            </span>
                          ))}
                        </div>
                      </div>

                      {result.bundleInfo.warnings.length ? (
                        <div className="bundle-group">
                          <div className="output-label inline-label">Warnings</div>
                          <pre className="output-content warning-text">{result.bundleInfo.warnings.join("\n")}</pre>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </Surface>
        </div>

        <Dialog.Root open={addFileOpen} onOpenChange={setAddFileOpen}>
          <Dialog size="sm" className="playground-dialog">
            <div className="dialog-header">
              <Dialog.Title>Add New File</Dialog.Title>
              <Button variant="secondary" shape="square" aria-label="Close add file dialog" onClick={() => setAddFileOpen(false)}>
                <X size={16} />
              </Button>
            </div>

            <Input
              autoFocus
              aria-label="New file name"
              className="modal-input"
              placeholder="e.g., src/utils.ts"
              value={addFileName}
              onChange={(event) => setAddFileName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  handleAddFile();
                }
              }}
            />

            <div className="dialog-actions">
              <Button variant="secondary" onClick={() => setAddFileOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleAddFile}>
                Add File
              </Button>
            </div>
          </Dialog>
        </Dialog.Root>

        <Dialog.Root open={githubOpen} onOpenChange={setGithubOpen}>
          <Dialog size="lg" className="playground-dialog">
            <div className="dialog-header">
              <div className="dialog-title-row">
                <GithubLogo size={20} weight="fill" />
                <Dialog.Title>Import from GitHub</Dialog.Title>
              </div>
              <Button variant="secondary" shape="square" aria-label="Close GitHub import dialog" onClick={() => setGithubOpen(false)}>
                <X size={16} />
              </Button>
            </div>

            <Dialog.Description className="dialog-description">
              Paste a GitHub URL to import files from any repository. Supports repos, branches, and subdirectories.
            </Dialog.Description>

            <Input
              autoFocus
              aria-label="GitHub URL"
              className="modal-input"
              placeholder="https://github.com/owner/repo/tree/branch/path"
              value={githubUrl}
              onChange={(event) => setGitHubUrl(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void importFromGitHub();
                }
              }}
            />

            <div className="github-examples">
              <span className="examples-label">Examples:</span>
              <button
                className="example-link"
                type="button"
                onClick={() => setGitHubUrl("https://github.com/honojs/starter/tree/main/templates/cloudflare-workers")}
              >
                Hono Starter
              </button>
            </div>

            <div className="dialog-actions">
              <Button variant="secondary" onClick={() => setGithubOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" loading={importing} onClick={() => void importFromGitHub()}>
                Import
              </Button>
            </div>
          </Dialog>
        </Dialog.Root>
      </main>
    </div>
  );
}
