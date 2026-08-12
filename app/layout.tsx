import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

import { ShellUserProvider } from "@/components/shell-user-provider";
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

  return (
    <html
      lang="en"
      data-theme={theme}
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="h-full overflow-hidden flex flex-col bg-bg-900 text-text-100">
        <ShellUserProvider name={name}>{children}</ShellUserProvider>
      </body>
    </html>
  );
}
