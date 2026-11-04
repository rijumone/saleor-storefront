import { type AddressDetailsFragment } from "@/gql/graphql";
import { cn } from "@/lib/utils";

type Props = {
	address: AddressDetailsFragment;
	isDefaultShipping?: boolean;
	isDefaultBilling?: boolean;
	className?: string;
	children?: React.ReactNode;
};

export function AccountAddressCard({
	address,
	isDefaultShipping,
	isDefaultBilling,
	className,
	children,
}: Props) {
	return (
		<div data-testid="account-address-card" className={cn("rounded-lg border p-4", className)}>
			<div className="flex items-start justify-between gap-4">
				<div className="min-w-0 space-y-1">
					<span className="block font-semibold">
						{address.firstName} {address.lastName}
					</span>
					{/*
					 * Keep the badges on their own row. Inline badges sat after names
					 * of different lengths, so "Default shipping" and "Default
					 * billing" never lined up across cards. The reserved height also
					 * keeps the address lines aligned when only one card is default.
					 */}
					<div className="flex min-h-[1.25rem] flex-wrap items-center gap-2">
						{isDefaultShipping && (
							<span className="inline-flex items-center rounded bg-secondary px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
								Default shipping
							</span>
						)}
						{isDefaultBilling && (
							<span className="inline-flex items-center rounded bg-secondary px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
								Default billing
							</span>
						)}
					</div>
					<p className="text-sm text-muted-foreground">{address.streetAddress1}</p>
					{address.streetAddress2 && (
						<p className="text-sm text-muted-foreground">{address.streetAddress2}</p>
					)}
					<p className="text-sm text-muted-foreground">
						{address.city}
						{address.countryArea && `, ${address.countryArea}`} {address.postalCode}
					</p>
					<p className="text-sm text-muted-foreground">{address.country.country}</p>
					{address.phone && <p className="mt-2 text-sm text-muted-foreground">{address.phone}</p>}
				</div>
				{children && <div className="flex shrink-0 items-center gap-1">{children}</div>}
			</div>
		</div>
	);
}
