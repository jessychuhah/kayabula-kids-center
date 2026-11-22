import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://kayabulakidscentre.org"),
  alternates: {
    canonical: "/",
  },
  title: "Kayabula Kids Centre | Youth & Community Support in Kampala",
  description:
    "Supporting under-served young people ages 14–25 through education, health and wellness, and basic needs support in Sanyu Road, Kampala.",
  icons: {
    icon: "/assets/logo.jpeg",
    shortcut: "/assets/logo.jpeg",
    apple: "/assets/logo.jpeg",
  },
};


export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
