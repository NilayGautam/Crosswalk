import type { Metadata, Viewport } from "next";
import { Courier_Prime, Libre_Franklin } from "next/font/google";
import type { ReactNode } from "react";
import { SessionProvider } from "@/lib/session";
import "./globals.css";

const franklin = Libre_Franklin({
  subsets: ["latin"],
  variable: "--font-franklin",
  display: "swap",
});

const courier = Courier_Prime({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-courier",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Crosswalk", template: "%s - Crosswalk" },
  description: "Put your datasets on a canvas and describe what you want done with them.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f7f6f2",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${franklin.variable} ${courier.variable}`}>
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
