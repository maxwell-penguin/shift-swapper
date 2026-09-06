import type { Metadata } from "next";
import { IBM_Plex_Sans } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const plexSans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: "Shift Swapper",
  description: "Request and track shift swaps",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={plexSans.className}>
      <body className="bg-stone-50 text-slate-900">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
