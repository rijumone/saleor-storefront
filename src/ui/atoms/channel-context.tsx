"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Channel slug provided by the server layout.
 *
 * Client components must not depend on `useParams()` for the channel during
 * hydration: with Cache Components / PPR the router params can be empty for the
 * first client render, so anything derived from them (e.g. link hrefs) differs
 * from the server HTML and React discards the server tree ("hydration failed").
 * The layout passes the server-resolved channel down through this context, so
 * the first client render always matches the server.
 */
const ChannelContext = createContext<string | undefined>(undefined);

export function ChannelProvider({ channel, children }: { channel: string; children: ReactNode }) {
	return <ChannelContext.Provider value={channel}>{children}</ChannelContext.Provider>;
}

/** Channel from the nearest provider, or undefined outside the channel layout. */
export function useChannel(): string | undefined {
	return useContext(ChannelContext);
}
