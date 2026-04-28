const SECRET_PATTERNS: Array<[RegExp, string]> = [
  [/(authorization:\s*bearer\s+)[^\s"'\\]+/gi, "$1[REDACTED]"],
  [/(api[_-]?key\s*[:=]\s*)["']?[^"'\s,}]+/gi, "$1[REDACTED]"],
  [/(token\s*[:=]\s*)["']?[^"'\s,}]+/gi, "$1[REDACTED]"],
  [/(password\s*[:=]\s*)["']?[^"'\s,}]+/gi, "$1[REDACTED]"],
  [/(secret\s*[:=]\s*)["']?[^"'\s,}]+/gi, "$1[REDACTED]"],
  [/(cookie:\s*)[^\r\n]+/gi, "$1[REDACTED]"],
  [/(set-cookie:\s*)[^\r\n]+/gi, "$1[REDACTED]"],
  [/\b(sk-[A-Za-z0-9_-]{16,})\b/g, "[REDACTED_OPENAI_KEY]"],
  [/\b(ghp_[A-Za-z0-9_]{20,})\b/g, "[REDACTED_GITHUB_TOKEN]"],
  [/\b([A-Za-z0-9+/]{32,}={0,2})\b/g, "[REDACTED_LONG_SECRET]"]
];

export function redactText(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  let redacted = value;
  for (const [pattern, replacement] of SECRET_PATTERNS) {
    redacted = redacted.replace(pattern, replacement);
  }
  return redacted;
}

export function redactObject<T>(value: T): T {
  if (typeof value === "string") {
    return redactText(value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactObject(item)) as T;
  }
  if (value && typeof value === "object") {
    const next: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      if (/authorization|cookie|password|secret|token|api[-_]?key/i.test(key)) {
        next[key] = "[REDACTED]";
      } else {
        next[key] = redactObject(item);
      }
    }
    return next as T;
  }
  return value;
}
