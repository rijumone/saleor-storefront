"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { type ComponentProps } from "react";
import { useChannel } from "./channel-context";

export const LinkWithChannel = ({
	href,
	...props
}: Omit<ComponentProps<typeof Link>, "href"> & { href: string }) => {
	// Prefer the server-provided channel: `useParams()` can be empty during the
	// first client render, which used to produce an href without the channel and
	// break hydration (server "/in/..." vs client "/...").
	const channelFromContext = useChannel();
	const { channel: channelFromParams } = useParams<{ channel?: string }>();
	const channel = channelFromContext ?? channelFromParams;

	if (!href.startsWith("/")) {
		return <Link {...props} href={href} />;
	}

	if (!channel) {
		return <Link {...props} href={href} />;
	}

	const encodedChannel = encodeURIComponent(channel);
	const hrefWithChannel = `/${encodedChannel}${href}`;
	return <Link {...props} href={hrefWithChannel} />;
};
