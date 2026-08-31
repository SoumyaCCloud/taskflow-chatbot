import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

import { ShellSessionProvider } from "@/components/shell-session-provider";
import { ShellUserProvider } from "@/components/shell-user-provider";
import { readSessionToken } from "@/lib/shell-session";
import { decodeFromHeader } from "@/lib/shell-user";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Taskflow AI Assistant",
  description: "Ask questions about your project.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // All resolved in proxy.ts from the iframe URL — the shell's cross-origin
  // frame can't send us the taskflow_theme / taskflow_session cookies.
  // Dark is the default per PRD/11-design-tokens.md.
  const requestHeaders = await headers();
  const theme =
    requestHeaders.get("x-taskflow-theme") === "light" ? "light" : "dark";

  const name = decodeFromHeader(requestHeaders.get("x-taskflow-name"));

  // Re-validated rather than trusted: the header is only as good as the proxy
  // that set it, and this one authorizes every agent call the chat makes.
  const token = readSessionToken(requestHeaders.get("x-taskflow-token"));

  return (
    <html
      lang="en"
      data-theme={theme}
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="h-full overflow-hidden flex flex-col bg-bg-900 text-text-100">
        <ShellUserProvider name={name}>
          <ShellSessionProvider token={token}>{children}</ShellSessionProvider>
        </ShellUserProvider>
      </body>
    </html>
  );
}
