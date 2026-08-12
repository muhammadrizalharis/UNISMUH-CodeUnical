import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "UNISMUH CodeUnical",
  description: "Platform ujian koding anti-nyontek — UNISMUH Informatika",
  icons: { icon: "/logo-emblem.png" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              // Mode lite HANYA utk perangkat sangat lemah (<=2 inti). Reduce-motion SENGAJA
              // TIDAK mematikan animasi (permintaan produk; animasi = transform/opacity ringan).
              "(function(){try{var c=navigator.hardwareConcurrency||8;if(c<=2){document.documentElement.classList.add('lite');}}catch(e){}})();",
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
