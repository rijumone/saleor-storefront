import { useUserQuery } from "@/checkout/graphql";

export const useUser = () => {
	// cache-and-network keeps the saved addresses fresh when the customer returns
	// to checkout after adding, editing or deleting an address elsewhere.
	const [{ data, fetching: loading, stale }, refetch] = useUserQuery({
		requestPolicy: "cache-and-network",
	});

	const user = data?.user;

	const authenticated = !!user?.id;

	return { user, loading: loading || stale, authenticated, refetch };
};
