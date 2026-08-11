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
  icons: { icon: "/LOGO-CODE-UNICAL.png" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var c=navigator.hardwareConcurrency||8,m=navigator.deviceMemory||8,r=matchMedia('(prefers-reduced-motion: reduce)').matches;if(c<=4||m<=4||r){document.documentElement.classList.add('lite');}}catch(e){}})();",
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
