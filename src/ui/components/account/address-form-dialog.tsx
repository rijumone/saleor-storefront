"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { Plus, Pencil } from "lucide-react";
import { toast } from "sonner";
import { type AddressDetailsFragment } from "@/gql/graphql";
import { type CountryCode } from "@/checkout/graphql";
import { AddressFields, FieldError, FormSelect } from "@/checkout/views/saleor-checkout/address-form-fields";
import {
	useAddressFormUtilsFromRules,
	type AddressValidationRules,
} from "@/checkout/components/address-form/use-address-form-derivation";
import { getAddressFormDataFromAddress, isValidPhone } from "@/checkout/components/address-form/utils";
import { type AddressFormData } from "@/checkout/components/address-form/types";
import { getCountryName } from "@/checkout/lib/utils/locale";
import { Button } from "@/ui/components/ui/button";
import { Label } from "@/ui/components/ui/label";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetDescription,
	SheetCloseButton,
} from "@/ui/components/ui/sheet";
import {
	createAddress,
	getAddressValidationRules,
	updateAddress,
} from "@/app/[channel]/(main)/account/actions";

type Props = {
	address?: AddressDetailsFragment;
	/** Countries the current channel ships to, mirroring the checkout selector. */
	availableCountries: CountryCode[];
};

const FALLBACK_COUNTRY = "IN" as CountryCode;

function getInitialFormData(
	address: AddressDetailsFragment | undefined,
	availableCountries: CountryCode[],
): AddressFormData {
	const data = getAddressFormDataFromAddress(address);
	const addressCountry = address?.country.code as CountryCode | undefined;
	const countryCode = addressCountry ?? availableCountries[0] ?? FALLBACK_COUNTRY;

	return { ...data, countryCode };
}

export function AddressFormDialog({ address, availableCountries }: Props) {
	const [open, setOpen] = useState(false);
	const [isPending, startTransition] = useTransition();
	const [formError, setFormError] = useState("");
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [formData, setFormData] = useState<AddressFormData>(() =>
		getInitialFormData(address, availableCountries),
	);
	const [rules, setRules] = useState<AddressValidationRules | null>(null);
	const [rulesLoading, setRulesLoading] = useState(false);
	const [rulesError, setRulesError] = useState("");
	const requestId = useRef(0);
	const isEditing = Boolean(address);

	const fetchRules = useCallback((countryCode: CountryCode) => {
		const id = ++requestId.current;

		setRulesLoading(true);
		setRulesError("");
		setRules(null);

		void getAddressValidationRules(countryCode)
			.then((nextRules) => {
				if (id !== requestId.current) return;

				if (!nextRules) {
					setRulesError("We couldn't load the address fields for this country. Please try again.");
					return;
				}

				setRules(nextRules);
			})
			.catch((error) => {
				if (id !== requestId.current) return;

				console.error("[account] failed to load address fields:", error);
				setRulesError("We couldn't load the address fields for this country. Please try again.");
			})
			.finally(() => {
				if (id === requestId.current) setRulesLoading(false);
			});
	}, []);

	/**
	 * Reset and load rules on the user action that opens the sheet. Doing this
	 * in an effect would re-run on every parent render and wipe the form.
	 */
	const openDialog = () => {
		const initial = getInitialFormData(address, availableCountries);

		setFormData(initial);
		setErrors({});
		setFormError("");
		setRules(null);
		setOpen(true);
		fetchRules(initial.countryCode);
	};

	const handleOpenChange = (nextOpen: boolean) => {
		if (nextOpen) {
			return;
		}

		requestId.current += 1;
		setOpen(false);
	};

	const { orderedAddressFields, getFieldLabel, isRequiredField, countryAreaChoices } =
		useAddressFormUtilsFromRules(rules, rulesLoading);

	const countryCodes = Array.from(
		new Set(availableCountries.length ? availableCountries : [formData.countryCode]),
	);
	if (!countryCodes.includes(formData.countryCode)) {
		countryCodes.unshift(formData.countryCode);
	}

	const handleCountryChange = (value: string) => {
		const countryCode = value as CountryCode;

		setFormData((previous) => ({ ...previous, countryCode, countryArea: "" }));
		setErrors((previous) => ({ ...previous, country: "", countryArea: "" }));
		setFormError("");
		fetchRules(countryCode);
	};

	const handleFieldChange = (field: string, value: string) => {
		setFormData((previous) => ({ ...previous, [field]: value }) as AddressFormData);
		setErrors((previous) => (previous[field] ? { ...previous, [field]: "" } : previous));
		setFormError((previous) => (previous ? "" : previous));
	};

	const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		if (!rules || rulesLoading || isPending) {
			return;
		}

		const form = event.currentTarget;
		const nextErrors: Record<string, string> = {};

		for (const field of orderedAddressFields) {
			if (field === "countryCode") continue;

			if (isRequiredField(field) && !formData[field]?.trim()) {
				nextErrors[field] = `${getFieldLabel(field)} is required`;
			}
		}

		const phone = formData.phone?.trim();
		if (!nextErrors.phone && phone && !isValidPhone(phone, formData.countryCode)) {
			nextErrors.phone = "Enter a valid phone number";
		}

		setErrors(nextErrors);

		if (Object.keys(nextErrors).length > 0) {
			const firstInvalidField = Object.keys(nextErrors)[0];
			form.querySelector<HTMLElement>(`[name="${firstInvalidField}"]`)?.focus();
			return;
		}

		setFormError("");
		const payload = new FormData(form);

		startTransition(async () => {
			const result = isEditing ? await updateAddress(payload) : await createAddress(payload);

			if (!result.success) {
				setFormError(result.error);
				if (result.fieldErrors) {
					setErrors(result.fieldErrors);
				}
				return;
			}

			toast.success(isEditing ? "Address updated" : "Address added", { position: "top-center" });
			setOpen(false);
		});
	};

	return (
		<>
			{isEditing ? (
				<Button variant="ghost" size="sm" onClick={openDialog} aria-label="Edit address">
					<Pencil className="h-3.5 w-3.5" />
				</Button>
			) : (
				<Button variant="outline-solid" size="sm" onClick={openDialog}>
					<Plus className="mr-1 h-4 w-4" />
					Add address
				</Button>
			)}
			<Sheet open={open} onOpenChange={handleOpenChange}>
				<SheetContent side="right" className="overflow-y-auto p-6">
					<SheetHeader className="mb-6">
						<SheetTitle>{isEditing ? "Edit address" : "Add new address"}</SheetTitle>
						<SheetDescription className="sr-only">
							{isEditing ? "Update your address details" : "Add a new address to your account"}
						</SheetDescription>
						<SheetCloseButton />
					</SheetHeader>

					<form onSubmit={handleSubmit} className="space-y-4">
						{isEditing && address && <input type="hidden" name="id" value={address.id} />}

						{formError && (
							<p role="alert" className="text-sm text-destructive">
								{formError}
							</p>
						)}

						<div className="space-y-1.5">
							<Label htmlFor="country" className="text-sm font-medium">
								Country/Region
							</Label>
							<FormSelect
								id="country"
								value={formData.countryCode}
								onChange={handleCountryChange}
								error={errors.country}
								placeholder="Select country"
								autoComplete="country"
								options={countryCodes.map((code) => ({
									value: code,
									label: getCountryName(code),
								}))}
							/>
							<FieldError error={errors.country} />
						</div>

						{rulesLoading || !rules ? (
							rulesError ? (
								<div role="alert" className="space-y-2 text-sm text-destructive">
									<p>{rulesError}</p>
									<Button
										type="button"
										variant="outline-solid"
										size="sm"
										onClick={() => fetchRules(formData.countryCode)}
									>
										Try again
									</Button>
								</div>
							) : (
								<div className="space-y-4" aria-busy="true" aria-label="Loading address fields">
									<div className="grid gap-4 sm:grid-cols-2">
										<div className="h-16 animate-pulse rounded-md bg-secondary" />
										<div className="h-16 animate-pulse rounded-md bg-secondary" />
									</div>
									{[0, 1, 2].map((row) => (
										<div key={row} className="h-16 animate-pulse rounded-md bg-secondary" />
									))}
								</div>
							)
						) : (
							<AddressFields
								orderedFields={orderedAddressFields}
								getFieldLabel={getFieldLabel}
								isRequiredField={isRequiredField}
								formData={formData as unknown as Record<string, string>}
								errors={errors}
								onFieldChange={handleFieldChange}
								countryAreaChoices={countryAreaChoices}
							/>
						)}

						<div className="flex gap-2 pt-2">
							<Button type="submit" disabled={isPending || rulesLoading || !rules} className="flex-1">
								{isPending ? "Saving…" : isEditing ? "Update address" : "Add address"}
							</Button>
						</div>
					</form>
				</SheetContent>
			</Sheet>
		</>
	);
}
