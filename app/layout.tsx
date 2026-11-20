import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kayabula Kids Centre | Youth & Community Support in Kampala",
  description:
    "Supporting vulnerable young people ages 14–25 through education, health and wellness, and basic needs support in Sanyu Road, Kampala.",
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
