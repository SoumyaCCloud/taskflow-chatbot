import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Taskflow AI Assistant",
  description: "Ask questions about your project.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Same cookie the shell reads, so the assistant follows the shell's theme.
  // Dark is the default per PRD/11-design-tokens.md.
  const theme =
    (await cookies()).get("taskflow_theme")?.value === "light" ? "light" : "dark";

  return (
    <html
      lang="en"
      data-theme={theme}
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="h-full overflow-hidden flex flex-col bg-bg-900 text-text-100">
        {children}
      </body>
    </html>
  );
}
