import Link from "next/link";
import { LinkWithChannel } from "../atoms/link-with-channel";
import { MenuGetBySlugDocument } from "@/gql/graphql";
import { executePublicGraphQL } from "@/lib/graphql";
import { CACHE_PROFILES, applyCacheProfile } from "@/lib/cache-manifest";
import { Logo } from "./shared/logo";
import { CopyrightText } from "./copyright-text";

// Default footer links when no CMS data is available
const defaultFooterLinks = {
	support: [
		{ label: "Contact Us", href: "/contact" },
		{ label: "FAQs", href: "/faq" },
		{ label: "Shipping", href: "/shipping" },
		{ label: "Returns", href: "/returns" },
	],
	company: [
		{ label: "About", href: "/about" },
		{ label: "Sustainability", href: "/sustainability" },
		{ label: "Careers", href: "/careers" },
		{ label: "Press", href: "/press" },
	],
};

/** Cached footer menu */
async function getFooterMenu(channel: string) {
	"use cache";
	applyCacheProfile(CACHE_PROFILES.footerMenu);

	const result = await executePublicGraphQL(MenuGetBySlugDocument, {
		variables: { slug: "footer", channel },
		revalidate: 60 * 60 * 24,
	});

	return result.ok ? result.data : null;
}

export async function Footer({ channel }: { channel: string }) {
	const footerLinks = await getFooterMenu(channel);

	const menuItems = footerLinks?.menu?.items || [];

	return (
		<footer className="bg-foreground text-background">
			{/* Extra bottom padding on mobile to account for sticky add-to-cart bar */}
			<div className="mx-auto max-w-7xl px-4 pb-24 pt-12 sm:px-6 sm:pb-12 lg:px-8 lg:py-16">
				<div className="grid grid-cols-2 gap-8 md:grid-cols-4 lg:gap-12">
					{/* Brand */}
					<div className="col-span-2 md:col-span-1">
						<Link href={`/${channel}`} prefetch={false} className="mb-4 inline-block">
							<Logo className="h-7 w-auto" inverted />
						</Link>
						<p className="mt-4 max-w-xs text-sm leading-relaxed text-neutral-400">
							{/* Minimal design, maximum impact. Thoughtfully crafted essentials for everyday comfort. */}
							{/* "You're here because you know something. What you know you can't explain, but you feel it. You've felt it your entire life." <em>- Morpheus, The Matrix</em> */}
							You&apos;re here because you know something. What you know you can&apos;t explain, but you feel
							it. You&apos;ve felt it your entire life.
							{/* You're here because you know something. What you know you can't explain, but you feel it. You've felt it your entire life. That there's something wrong with the world, you don't know what it is, but it's there. */}
						</p>
					</div>

					{/* Dynamic menu items from Saleor CMS */}
					{menuItems.map((item) => (
						<div key={item.id}>
							<h4 className="mb-4 text-sm font-medium text-neutral-300">{item.name}</h4>
							<ul className="space-y-3">
								{item.children?.map((child) => {
									if (child.category) {
										return (
											<li key={child.id}>
												<LinkWithChannel
													href={`/categories/${child.category.slug}`}
													prefetch={false}
													className="text-sm text-neutral-400 transition-colors hover:text-neutral-200"
												>
													{child.category.name}
												</LinkWithChannel>
											</li>
										);
									}
									if (child.collection) {
										return (
											<li key={child.id}>
												<LinkWithChannel
													href={`/collections/${child.collection.slug}`}
													prefetch={false}
													className="text-sm text-neutral-400 transition-colors hover:text-neutral-200"
												>
													{child.collection.name}
												</LinkWithChannel>
											</li>
										);
									}
									if (child.page) {
										return (
											<li key={child.id}>
												<LinkWithChannel
													href={`/pages/${child.page.slug}`}
													prefetch={false}
													className="text-sm text-neutral-400 transition-colors hover:text-neutral-200"
												>
													{child.page.title}
												</LinkWithChannel>
											</li>
										);
									}
									if (child.url) {
										return (
											<li key={child.id}>
												<Link
													href={child.url}
													prefetch={false}
													className="text-sm text-neutral-400 transition-colors hover:text-neutral-200"
												>
													{child.name}
												</Link>
											</li>
										);
									}
									return null;
								})}
							</ul>
						</div>
					))}

					{/* Static Support links (if no CMS data) */}
					{menuItems.length === 0 && (
						<>
							<div>
								<h4 className="mb-4 text-sm font-medium text-neutral-300">Support</h4>
								<ul className="space-y-3">
									{defaultFooterLinks.support.map((link) => (
										<li key={link.href}>
											<Link
												href={link.href}
												prefetch={false}
												className="text-sm text-neutral-400 transition-colors hover:text-neutral-200"
											>
												{link.label}
											</Link>
										</li>
									))}
								</ul>
							</div>
							<div>
								<h4 className="mb-4 text-sm font-medium text-neutral-300">Company</h4>
								<ul className="space-y-3">
									{defaultFooterLinks.company.map((link) => (
										<li key={link.href}>
											<Link
												href={link.href}
												prefetch={false}
												className="text-sm text-neutral-400 transition-colors hover:text-neutral-200"
											>
												{link.label}
											</Link>
										</li>
									))}
								</ul>
							</div>
						</>
					)}
				</div>

				{/*
				 * Channel/currency selector intentionally disabled. The storefront
				 * currently serves only the default channel, so switching currency
				 * would imply multi-channel support we do not provide yet.
				 */}

				{/* Bottom bar */}
				<div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-neutral-800 pt-8 sm:flex-row">
					<p className="text-xs text-neutral-500">
						<CopyrightText />
					</p>
					<div className="flex items-center gap-6">
						<LinkWithChannel
							href="/pages/privacy"
							prefetch={false}
							className="text-xs text-neutral-500 transition-colors hover:text-neutral-300"
						>
							Privacy Policy
						</LinkWithChannel>
						<LinkWithChannel
							href="/pages/terms"
							prefetch={false}
							className="text-xs text-neutral-500 transition-colors hover:text-neutral-300"
						>
							Terms of Service
						</LinkWithChannel>
					</div>
				</div>
			</div>
		</footer>
	);
}
