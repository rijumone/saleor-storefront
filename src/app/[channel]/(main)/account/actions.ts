"use server";

import { revalidatePath } from "next/cache";
import {
	AccountUpdateDocument,
	PasswordChangeDocument,
	AccountAddressCreateDocument,
	AccountAddressUpdateDocument,
	AccountAddressDeleteDocument,
	AccountSetDefaultAddressDocument,
	AccountRequestDeletionDocument,
	AddressValidationRulesDocument,
	type AddressInput,
	type CountryCode,
	AddressTypeEnum,
} from "@/gql/graphql";
import { executeAuthenticatedGraphQL, executePublicGraphQL } from "@/lib/graphql";
import type { AddressValidationRules } from "@/checkout/components/address-form/use-address-form-derivation";
import { getFormString, getFormStringOptional } from "@/ui/components/account/form-utils";

type ActionResult =
	| { success: true }
	| { success: false; error: string; fieldErrors?: Record<string, string> };

function getAddressFieldErrors(
	errors: ReadonlyArray<{ field?: string | null; message?: string | null }> | undefined,
): Record<string, string> {
	const fieldErrors: Record<string, string> = {};

	for (const error of errors ?? []) {
		if (error.field && error.message) {
			fieldErrors[error.field] = error.message;
		}
	}

	return fieldErrors;
}

function addressActionError(error: string, fieldErrors: Record<string, string>): ActionResult {
	return Object.keys(fieldErrors).length ? { success: false, error, fieldErrors } : { success: false, error };
}

/**
 * Country-specific address rules for the account address form. The checkout
 * gets these through urql; the account area calls this public query instead of
 * mounting the whole checkout provider tree.
 */
export async function getAddressValidationRules(countryCode: string): Promise<AddressValidationRules | null> {
	const result = await executePublicGraphQL(AddressValidationRulesDocument, {
		variables: { countryCode: countryCode as CountryCode },
		cache: "no-cache",
	});

	if (!result.ok) {
		console.error("[account] failed to load address validation rules:", result.error.message);
		return null;
	}

	return result.data.addressValidationRules ?? null;
}

export async function updateProfile(formData: FormData): Promise<ActionResult> {
	const firstName = getFormString(formData, "firstName");
	const lastName = getFormString(formData, "lastName");

	const result = await executeAuthenticatedGraphQL(AccountUpdateDocument, {
		variables: { input: { firstName, lastName } },
		cache: "no-cache",
	});

	if (!result.ok) {
		return { success: false, error: result.error.message };
	}

	const errors = result.data.accountUpdate?.errors;
	if (errors?.length) {
		return { success: false, error: errors[0].message ?? "Failed to update profile" };
	}

	revalidatePath("/account", "layout");
	return { success: true };
}

export async function changePassword(formData: FormData): Promise<ActionResult> {
	const oldPassword = getFormString(formData, "oldPassword");
	const newPassword = getFormString(formData, "newPassword");
	const confirmPassword = getFormString(formData, "confirmPassword");

	if (newPassword.length < 8) {
		return { success: false, error: "New password must be at least 8 characters" };
	}

	if (newPassword !== confirmPassword) {
		return { success: false, error: "Passwords do not match" };
	}

	const result = await executeAuthenticatedGraphQL(PasswordChangeDocument, {
		variables: { oldPassword, newPassword },
		cache: "no-cache",
	});

	if (!result.ok) {
		return { success: false, error: result.error.message };
	}

	const errors = result.data.passwordChange?.errors;
	if (errors?.length) {
		return { success: false, error: errors[0].message ?? "Failed to change password" };
	}

	return { success: true };
}

export async function createAddress(formData: FormData): Promise<ActionResult> {
	const input = extractAddressInput(formData);

	const result = await executeAuthenticatedGraphQL(AccountAddressCreateDocument, {
		variables: { input },
		cache: "no-cache",
	});

	if (!result.ok) {
		console.error("[account] createAddress failed:", result.error);
		return { success: false, error: "We couldn't save this address. Please try again." };
	}

	const errors = result.data.accountAddressCreate?.errors;
	if (errors?.length) {
		const fieldErrors = getAddressFieldErrors(errors);
		return addressActionError(
			errors[0]?.message ?? "We couldn't save this address. Please check the fields and try again.",
			fieldErrors,
		);
	}

	revalidatePath("/account/addresses", "page");
	return { success: true };
}

export async function updateAddress(formData: FormData): Promise<ActionResult> {
	const id = getFormString(formData, "id");
	const input = extractAddressInput(formData);

	const result = await executeAuthenticatedGraphQL(AccountAddressUpdateDocument, {
		variables: { id, input },
		cache: "no-cache",
	});

	if (!result.ok) {
		console.error("[account] updateAddress failed:", result.error);
		return { success: false, error: "We couldn't save this address. Please try again." };
	}

	const errors = result.data.accountAddressUpdate?.errors;
	if (errors?.length) {
		const fieldErrors = getAddressFieldErrors(errors);
		return addressActionError(
			errors[0]?.message ?? "We couldn't save this address. Please check the fields and try again.",
			fieldErrors,
		);
	}

	revalidatePath("/account/addresses", "page");
	return { success: true };
}

export async function deleteAddress(formData: FormData): Promise<ActionResult> {
	const id = getFormString(formData, "id");

	const result = await executeAuthenticatedGraphQL(AccountAddressDeleteDocument, {
		variables: { id },
		cache: "no-cache",
	});

	if (!result.ok) {
		return { success: false, error: result.error.message };
	}

	const errors = result.data.accountAddressDelete?.errors;
	if (errors?.length) {
		return { success: false, error: errors[0].message ?? "Failed to delete address" };
	}

	revalidatePath("/account/addresses", "page");
	return { success: true };
}

export async function setDefaultAddress(formData: FormData): Promise<ActionResult> {
	const id = getFormString(formData, "id");
	const type = getFormString(formData, "type");

	const addressType = type === "BILLING" ? AddressTypeEnum.Billing : AddressTypeEnum.Shipping;

	const result = await executeAuthenticatedGraphQL(AccountSetDefaultAddressDocument, {
		variables: { id, type: addressType },
		cache: "no-cache",
	});

	if (!result.ok) {
		return { success: false, error: result.error.message };
	}

	const errors = result.data.accountSetDefaultAddress?.errors;
	if (errors?.length) {
		return { success: false, error: errors[0].message ?? "Failed to set default address" };
	}

	revalidatePath("/account/addresses", "page");
	return { success: true };
}

export async function requestAccountDeletion(formData: FormData): Promise<ActionResult> {
	const redirectUrl = getFormString(formData, "redirectUrl");
	const channel = getFormStringOptional(formData, "channel");

	const result = await executeAuthenticatedGraphQL(AccountRequestDeletionDocument, {
		variables: { redirectUrl, channel },
		cache: "no-cache",
	});

	if (!result.ok) {
		return { success: false, error: result.error.message };
	}

	const errors = result.data.accountRequestDeletion?.errors;
	if (errors?.length) {
		return { success: false, error: errors[0].message ?? "Failed to request account deletion" };
	}

	return { success: true };
}

function extractAddressInput(formData: FormData): AddressInput {
	const value = (key: string) => {
		const raw = getFormStringOptional(formData, key)?.trim();
		return raw ? raw : undefined;
	};

	return {
		firstName: value("firstName"),
		lastName: value("lastName"),
		companyName: value("companyName"),
		streetAddress1: value("streetAddress1"),
		streetAddress2: value("streetAddress2"),
		city: value("city"),
		cityArea: value("cityArea"),
		postalCode: value("postalCode"),
		countryArea: value("countryArea"),
		country: value("country") as CountryCode | undefined,
		phone: value("phone"),
	};
}
