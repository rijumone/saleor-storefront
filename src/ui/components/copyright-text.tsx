"use client";

import { useSyncExternalStore } from "react";
import { brandConfig, getCopyrightText } from "@/config/brand";

/**
 * Copyright line with the current year.
 *
 * The year is a client-only value: computing it during render made it differ
 * from the prerendered HTML (server/build clock vs visitor clock), and React
 * discarded the server tree and re-rendered the page — visible as cart/badge
 * content flickering across the whole site.
 *
 * `useSyncExternalStore` returns the server snapshot (no year) for SSR and the
 * hydration render, then switches to the client value after hydration, so the
 * first client render always matches the server HTML.
 */
const subscribe = () => () => {};
const getClientSnapshot = () => new Date().getFullYear();
const getServerSnapshot = () => null;

export function CopyrightText() {
	const year = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);

	return (
		<span>
			{year === null ? `© ${brandConfig.copyrightHolder}. All rights reserved.` : getCopyrightText(year)}
		</span>
	);
}
