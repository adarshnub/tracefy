type BrowserEvent = Record<string, unknown>;

const originalConsole = {
  error: console.error.bind(console),
  warn: console.warn.bind(console),
  info: console.info.bind(console),
  debug: console.debug.bind(console)
};

for (const level of ["error", "warn", "info", "debug"] as const) {
  console[level] = (...args: unknown[]) => {
    originalConsole[level](...args);
    emit({
      kind: "browser.console",
      source: "browser",
      level: level === "warn" ? "warning" : level === "error" ? "error" : level,
      message: args.map(formatValue).join(" "),
      url: location.href,
      stack: new Error().stack
    });
  };
}

window.addEventListener(
  "error",
  (event) => {
    const target = event.target;
    if (
      target instanceof HTMLScriptElement ||
      target instanceof HTMLImageElement ||
      target instanceof HTMLLinkElement
    ) {
      emit({
        kind: "browser.network.failed",
        source: "browser",
        url: String(target instanceof HTMLLinkElement ? target.href : target.src || location.href),
        message: "Resource failed to load"
      });
      return;
    }

    emit({
      kind: "browser.error",
      source: "browser",
      message: event.message,
      url: event.filename || location.href,
      line: event.lineno,
      column: event.colno,
      stack: event.error?.stack
    });
  },
  true
);

window.addEventListener("unhandledrejection", (event) => {
  emit({
    kind: "browser.error",
    source: "browser",
    message: `Unhandled promise rejection: ${formatValue(event.reason)}`,
    url: location.href,
    stack: event.reason?.stack
  });
});

const originalFetch = window.fetch.bind(window);
window.fetch = async (...args: Parameters<typeof fetch>) => {
  const request = args[0];
  const url = typeof request === "string" ? request : request instanceof URL ? request.toString() : request.url;
  const method = args[1]?.method || (typeof request !== "string" && !(request instanceof URL) ? request.method : "GET");
  try {
    const response = await originalFetch(...args);
    if (!response.ok) {
      emit({
        kind: "browser.network.failed",
        source: "browser",
        method,
        url,
        status: response.status,
        statusText: response.statusText
      });
    }
    return response;
  } catch (error) {
    emit({
      kind: "browser.network.failed",
      source: "browser",
      method,
      url,
      message: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
};

const originalOpen = XMLHttpRequest.prototype.open;
const originalSend = XMLHttpRequest.prototype.send;

XMLHttpRequest.prototype.open = function patchedOpen(method: string, url: string | URL, ...rest: unknown[]) {
  (this as XMLHttpRequest & { __tracefy?: { method: string; url: string } }).__tracefy = {
    method,
    url: String(url)
  };
  return (originalOpen as any).call(this, method, url, ...rest);
};

XMLHttpRequest.prototype.send = function patchedSend(...args: Parameters<XMLHttpRequest["send"]>) {
  this.addEventListener("loadend", () => {
    const meta = (this as XMLHttpRequest & { __tracefy?: { method: string; url: string } }).__tracefy;
    if (meta && this.status >= 400) {
      emit({
        kind: "browser.network.failed",
        source: "browser",
        method: meta.method,
        url: meta.url,
        status: this.status,
        statusText: this.statusText
      });
    }
  });
  return originalSend.apply(this, args);
};

function emit(event: BrowserEvent): void {
  window.postMessage(
    {
      type: "tracefy.pageEvent",
      event: {
        ...event,
        timestamp: Date.now()
      }
    },
    "*"
  );
}

function formatValue(value: unknown): string {
  if (value instanceof Error) {
    return `${value.name}: ${value.message}\n${value.stack ?? ""}`;
  }
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
