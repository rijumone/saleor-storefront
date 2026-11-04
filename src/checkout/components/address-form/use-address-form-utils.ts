import {
	type CountryCode,
	useAddressValidationRulesQuery,
	type ValidationRulesFragment,
} from "@/checkout/graphql";
import { defaultCountry } from "@/checkout/lib/consts/countries";

import { useAddressFormUtilsFromRules } from "./use-address-form-derivation";

export {
	addressFieldMessages,
	localizedAddressFieldMessages,
	type AddressFieldLabel,
	type LocalizedAddressFieldLabel,
} from "./use-address-form-derivation";
export { useAddressFormUtilsFromRules };

/**
 * Checkout-side address rules: fetch from Saleor with urql, then derive the
 * field configuration. The derivation itself lives in a separate, query-free
 * hook so the account area can reuse it without a checkout urql provider.
 */
export const useAddressFormUtils = (countryCode: CountryCode = defaultCountry) => {
	const [{ data, fetching }] = useAddressValidationRulesQuery({
		variables: { countryCode },
	});

	return useAddressFormUtilsFromRules(
		data?.addressValidationRules as ValidationRulesFragment | undefined,
		fetching,
	);
};
