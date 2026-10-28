import { type ReactNode } from "react";
import { AuthProvider } from "@/lib/auth";
import { brandConfig } from "@/config/brand";
import { seoTitle } from "@/lib/seo";

export const metadata = {
	title: seoTitle("Checkout"),
	description: brandConfig.description,
};

export default function RootLayout(props: { children: ReactNode }) {
	return (
		<main>
			<AuthProvider>{props.children}</AuthProvider>
		</main>
	);
}
