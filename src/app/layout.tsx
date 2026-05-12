import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { type ReactNode } from "react";
import { rootMetadata } from "@/lib/seo";
import { localeConfig } from "@/config/locale";
import { SpeedInsights } from "@vercel/speed-insights/next";

/**
 * Root metadata for the entire site.
 * Configuration is in src/lib/seo/config.ts
 */
export const metadata = rootMetadata;

export default function RootLayout(props: { children: ReactNode }) {
	const { children } = props;

	return (
		<html lang={localeConfig.htmlLang} className={`${GeistSans.variable} ${GeistMono.variable} min-h-dvh`}>
			<head>
				{process.env.UMAMI_TRACKING && (
					<script
						defer
						src="https://umami.riju.tech/script.js"
						data-website-id={process.env.UMAMI_TRACKING}
					></script>
				)}
			</head>
			<body className="min-h-dvh font-sans">
				{children}
				<SpeedInsights />
			</body>
		</html>
	);
}
