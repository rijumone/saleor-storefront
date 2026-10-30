import { ChannelCurrencyDocument } from "@/gql/graphql";
import { executePublicGraphQL } from "@/lib/graphql";
import { localeConfig } from "@/config/locale";

/**
 * Resolve the currency a channel's prices are expressed in.
 *
 * Price-range filters are evaluated by Saleor in the channel currency, so the
 * buckets and their labels must use the same currency. Reading it from the
 * catalog (rather than hardcoding it) keeps the filter correct on INR stores
 * and on every other channel.
 *
 * Uses the first product of the channel as the source: it is available without
 * elevated permissions and is cached, so the filtered (possibly empty) product
 * list can still be labelled correctly.
 */
export async function getChannelCurrency(channel: string): Promise<string> {
	const result = await executePublicGraphQL(ChannelCurrencyDocument, {
		variables: { channel },
		revalidate: 60 * 60, // 1 hour - a channel's currency rarely changes
	});

	if (!result.ok) {
		console.warn(`[ChannelCurrency] Failed to resolve currency for "${channel}":`, result.error.message);
		return localeConfig.fallbackCurrency;
	}

	return (
		result.data.products?.edges[0]?.node.pricing?.priceRange?.start?.gross.currency ??
		localeConfig.fallbackCurrency
	);
}
