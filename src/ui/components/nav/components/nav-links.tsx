import Link from "next/link";
import { NavLink } from "./nav-link";
import { executePublicGraphQL } from "@/lib/graphql";
import { MenuGetBySlugDocument } from "@/gql/graphql";
import { CACHE_PROFILES, applyCacheProfile } from "@/lib/cache-manifest";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	DropdownMenuSub,
	DropdownMenuSubTrigger,
	DropdownMenuSubContent,
	DropdownMenuPortal,
} from "@/ui/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";
import { LinkWithChannel } from "@/ui/atoms/link-with-channel";

// Helper function to get href from a menu item
function getMenuItemHref(item: any) {
	if (item.category) return `/categories/${item.category.slug}`;
	if (item.collection) return `/collections/${item.collection.slug}`;
	if (item.page) return `/pages/${item.page.slug}`;
	if (item.url) return item.url;
	return "";
}

function RecursiveMenuNode({ item }: { item: any }) {
	const hasChildren = item.children && item.children.length > 0;
	const href = getMenuItemHref(item);

	if (hasChildren) {
		return (
			<DropdownMenuSub>
				<DropdownMenuSubTrigger className="cursor-pointer">{item.name}</DropdownMenuSubTrigger>
				<DropdownMenuPortal>
					<DropdownMenuSubContent className="w-48">
						{href && (
							<DropdownMenuItem asChild>
								<LinkWithChannel href={href} className="w-full cursor-pointer">
									All {item.name}
								</LinkWithChannel>
							</DropdownMenuItem>
						)}
						{item.children.map((child: any) => {
							if (!child) return null;
							return <RecursiveMenuNode key={child.id} item={child} />;
						})}
					</DropdownMenuSubContent>
				</DropdownMenuPortal>
			</DropdownMenuSub>
		);
	}

	if (!href) return null;

	return (
		<DropdownMenuItem asChild>
			<LinkWithChannel href={href} className="w-full cursor-pointer">
				{item.name}
			</LinkWithChannel>
		</DropdownMenuItem>
	);
}

export const NavLinks = async ({ channel }: { channel: string }) => {
	"use cache";
	applyCacheProfile(CACHE_PROFILES.navigation);

	const result = await executePublicGraphQL(MenuGetBySlugDocument, {
		variables: { slug: "navbar", channel },
		revalidate: 60 * 60, // 1 hour
	});

	if (!result.ok) {
		// During build, if the API is unreachable, render minimal nav.
		// The page will re-fetch when a user visits.
		console.warn(`[NavLinks] Failed to fetch navigation for ${channel}:`, result.error.message);
		return <NavLink href="/products">All</NavLink>;
	}

	return (
		<>
			<NavLink href="/products">All</NavLink>
			{result.data.menu?.items?.map((item) => {
				const hasChildren = item.children && item.children.length > 0;
				const href = getMenuItemHref(item);

				if (hasChildren) {
					return (
						<li key={item.id} className="inline-flex">
							<DropdownMenu>
								<DropdownMenuTrigger className="flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
									{item.name}
									<ChevronDown className="h-4 w-4" />
								</DropdownMenuTrigger>
								<DropdownMenuContent align="start" className="w-48">
									{href && (
										<DropdownMenuItem asChild>
											<LinkWithChannel href={href} className="w-full cursor-pointer">
												All {item.name}
											</LinkWithChannel>
										</DropdownMenuItem>
									)}
									{item.children?.map((child: any) => {
										if (!child) return null;
										return <RecursiveMenuNode key={child.id} item={child} />;
									})}
								</DropdownMenuContent>
							</DropdownMenu>
						</li>
					);
				}

				if (item.url && !item.category && !item.collection && !item.page) {
					return (
						<li key={item.id} className="inline-flex">
							<Link
								href={item.url}
								prefetch={false}
								className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
							>
								{item.name}
							</Link>
						</li>
					);
				}

				if (href) {
					return (
						<NavLink key={item.id} href={href}>
							{item.name}
						</NavLink>
					);
				}

				return null;
			})}
		</>
	);
};
