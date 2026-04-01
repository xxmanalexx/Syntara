import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Syntara — AI Instagram Content OS",
  description: "AI-native Instagram content operating system for creators and brands",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased min-h-screen bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
