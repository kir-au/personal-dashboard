import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import "../globals.css";
import { Toaster } from "sonner";

const roboto = Roboto({
  weight: ['300', '400', '500', '700'],
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: "Personal Dashboard - Markdown Viewer",
  description: "Clean markdown viewer for Personal Vault content",
};

export default function ViewLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={roboto.className}>
      <body className="min-h-screen bg-background antialiased">
        {/* Clean layout - no sidebar, no top bar */}
        <main className="min-h-screen">
          {children}
        </main>
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
