import type { Locale } from "@/config/site";
import type { ReactNode } from "react";

import { themeInitScript } from "../theme-init";

import "../globals.css";

export default function AdminDocument({
  locale,
  children,
}: Readonly<{
  locale: Locale;
  children: ReactNode;
}>) {
  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script data-theme-init dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
