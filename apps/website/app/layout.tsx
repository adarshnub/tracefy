import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tracefy | Local-first AI debugging context",
  description:
    "Tracefy captures browser, terminal, diagnostics, code context, and git diff so AI agents can debug local JavaScript failures with evidence.",
  openGraph: {
    title: "Tracefy",
    description: "Local-first AI debugging context for VS Code, Cursor, Chrome, terminal output, and agent handoff.",
    type: "website"
  }
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
