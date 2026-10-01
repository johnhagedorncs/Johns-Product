import type { Metadata, Viewport } from "next";
import { Crimson_Pro, Inter, JetBrains_Mono } from "next/font/google";
import { AppNav } from "@/components/app-nav";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const crimson = Crimson_Pro({
  variable: "--font-crimson",
  subsets: ["latin"],
  weight: ["300", "400"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Warm Apply",
  description: "Apply today, warm outreach second",
};

// Desktop-only website: phones render the full desktop layout, zoomed out.
export const viewport: Viewport = {
  width: 1100,
  initialScale: undefined,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${crimson.variable} ${jetbrains.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(localStorage.getItem('warm-theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}",
          }}
        />
      </head>
      <body className="min-h-full min-w-[1024px] bg-background font-sans text-foreground">
        <AppNav />
        {children}
      </body>
    </html>
  );
}
