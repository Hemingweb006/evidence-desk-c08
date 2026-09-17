import type { Metadata } from "next";
import { BagPanel } from "@/components/BagPanel";
import { Footer, TopBar } from "@/components/Chrome";
import { ImpactBanner } from "@/components/ImpactBanner";
import { Sidebar } from "@/components/Sidebar";
import { WorkspaceProvider } from "@/components/workspace";
import "./globals.css";

export const metadata: Metadata = {
  title: "Evidence Desk · Sachberichte prüfen (Übung C08)",
  description: "Exercise prototype: turn mixed field evidence into a reviewable progress report without polishing away uncertainty. Fictional data; not a Schmitz-Stiftungen service.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Lato:wght@400;700;900&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased">
        <WorkspaceProvider>
          <TopBar />
          <div className="flex min-h-screen flex-col md:flex-row">
            <Sidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              <main className="min-w-0 flex-1 px-4 py-6 md:px-8">
                <ImpactBanner />
                {children}
              </main>
              <Footer />
            </div>
          </div>
          <BagPanel />
        </WorkspaceProvider>
      </body>
    </html>
  );
}
