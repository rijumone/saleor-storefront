import camelCase from "lodash-es/camelCase";
import { useCallback, useMemo } from "react";

import { type AddressField } from "./types";
import { getOrderedAddressFields, getRequiredAddressFields } from "./utils";

/**
 * The subset of Saleor's `addressValidationRules` this form needs.
 *
 * Both the storefront and checkout codegen outputs are structurally compatible
 * with this shape, which lets the same field derivation run in the account area
 * (plain `fetch`/server action) and in the checkout (urql).
 */
export interface AddressValidationRules {
	addressFormat?: string | null;
	allowedFields?: string[] | null;
	requiredFields?: string[] | null;
	countryAreaType?: string | null;
	postalCodeType?: string | null;
	cityType?: string | null;
	countryAreaChoices?: Array<{ raw?: unknown; verbose?: unknown }> | null;
}

// Default fields to show while loading country-specific validation rules
export const DEFAULT_ADDRESS_FIELDS: AddressField[] = [
	"firstName",
	"lastName",
	"companyName",
	"streetAddress1",
	"streetAddress2",
	"city",
	"postalCode",
	"countryArea",
	"phone",
];

export type AddressFieldLabel = Exclude<AddressField, "countryCode"> | "country";
export const addressFieldMessages: Record<AddressFieldLabel, string> = {
	city: "City",
	firstName: "First name",
	countryArea: "Country area",
	lastName: "Last name",
	country: "Country",
	cityArea: "City area",
	postalCode: "Postal code",
	companyName: "Company",
	streetAddress1: "Street address",
	streetAddress2: "Apartment, suite, etc.",
	phone: "Phone number",
};

export type LocalizedAddressFieldLabel =
	| "province"
	| "district"
	| "state"
	| "zip"
	| "postal"
	| "postTown"
	| "prefecture"
	| "pin";
export const localizedAddressFieldMessages: Record<LocalizedAddressFieldLabel, string> = {
	province: "Province",
	district: "District",
	state: "State",
	zip: "Zip code",
	postal: "Postal code",
	postTown: "Post town",
	prefecture: "Prefecture",
	pin: "PIN code",
};

/**
 * Turn Saleor's country-specific rules into everything an address form needs.
 *
 * Kept separate from the urql query so any surface (checkout, account) can use
 * the exact same labels, ordering and required-field rules.
 */
export const useAddressFormUtilsFromRules = (
	validationRules: AddressValidationRules | null | undefined,
	fetching = false,
) => {
	const { countryAreaType, postalCodeType, cityType } = validationRules ?? {};

	const localizedFields = useMemo(
		() => ({
			countryArea: countryAreaType,
			city: cityType,
			postalCode: postalCodeType,
		}),
		[cityType, countryAreaType, postalCodeType],
	);

	const isRequiredField = useCallback(
		(field: AddressField) =>
			getRequiredAddressFields(validationRules?.requiredFields as AddressField[] | undefined).includes(field),
		[validationRules?.requiredFields],
	);

	const getMissingFieldsFromAddress = useCallback(
		(address: Record<string, unknown> | null | undefined) => {
			if (!address) {
				return [];
			}

			return Object.entries(address).reduce((result, [fieldName, fieldValue]) => {
				if (!isRequiredField(fieldName as AddressField)) {
					return result;
				}

				return !!fieldValue ? result : ([...result, fieldName] as AddressField[]);
			}, [] as AddressField[]);
		},
		[isRequiredField],
	);

	const hasAllRequiredFields = useCallback(
		(address: Record<string, unknown> | null | undefined) => !getMissingFieldsFromAddress(address).length,
		[getMissingFieldsFromAddress],
	);

	const getLocalizedFieldLabel = useCallback((field: AddressField, localizedField?: string) => {
		try {
			const translatedLabel =
				localizedAddressFieldMessages[camelCase(localizedField) as LocalizedAddressFieldLabel];
			return translatedLabel;
		} catch (e) {
			console.warn(`Missing translation: ${localizedField}`);
			return addressFieldMessages[camelCase(field) as AddressFieldLabel];
		}
	}, []);

	const getFieldLabel = useCallback(
		(field: AddressField) => {
			const localizedField = localizedFields[field as keyof typeof localizedFields];

			const isLocalizedField = !!localizedField && localizedField !== field;

			if (isLocalizedField) {
				return getLocalizedFieldLabel(field, localizedField as LocalizedAddressFieldLabel);
			}

			return addressFieldMessages[field as AddressFieldLabel];
		},
		[getLocalizedFieldLabel, localizedFields],
	);

	// Calculate ordered address fields from validation rules
	const orderedAddressFields = useMemo(() => {
		if (validationRules?.allowedFields) {
			return getOrderedAddressFields(validationRules.allowedFields as AddressField[]);
		}
		// While loading, show default fields
		return DEFAULT_ADDRESS_FIELDS;
	}, [validationRules?.allowedFields]);

	return {
		orderedAddressFields,
		getFieldLabel,
		isRequiredField,
		hasAllRequiredFields,
		getMissingFieldsFromAddress,
		fetching,
		...validationRules,
		allowedFields: validationRules?.allowedFields as AddressField[] | undefined,
		countryAreaChoices: validationRules?.countryAreaChoices ?? undefined,
	};
};
