"use client";

import { type FC } from "react";
import { SignedInUser, GuestContact } from "@/checkout/components/contact";

// Newsletter opt-in is disabled while the store has no newsletter.
// To restore, uncomment these imports, the two props in ContactSectionProps,
// the two destructured parameters, and the JSX block at the end of the
// component.
// import { Label } from "@/ui/components/ui/label";
// import { Checkbox } from "@/ui/components/ui/checkbox";

// User type matching what useUser() returns
type User = {
	id: string;
	email: string;
	firstName?: string | null;
	lastName?: string | null;
};

// =============================================================================
// Types
// =============================================================================

interface ContactSectionProps {
	// Auth state
	isSignedIn: boolean;
	user: User | null | undefined;
	onSignOut: () => void;
	onSignInClick: () => void;

	// Email state (guests)
	email: string;
	onEmailChange: (value: string) => void;
	onEmailBlur: () => void;
	emailError?: string;

	// Create account state (guests)
	createAccount: boolean;
	onCreateAccountChange: (value: boolean) => void;
	password: string;
	onPasswordChange: (value: string) => void;
	passwordError?: string;

	// Subscribe state (guests) - disabled while the store has no newsletter.
	// subscribeNews: boolean;
	// onSubscribeChange: (value: boolean) => void;
}

// =============================================================================
// Component
// =============================================================================

export const ContactSection: FC<ContactSectionProps> = ({
	isSignedIn,
	user,
	onSignOut,
	onSignInClick,
	email,
	onEmailChange,
	onEmailBlur,
	emailError,
	createAccount,
	onCreateAccountChange,
	password,
	onPasswordChange,
	passwordError,
	// Newsletter opt-in (disabled).
	// subscribeNews,
	// onSubscribeChange,
}) => {
	return (
		<section className="space-y-4">
			{isSignedIn && user ? (
				<>
					<h2 className="text-xl font-semibold">Contact</h2>
					<SignedInUser user={user} onSignOut={onSignOut} />
				</>
			) : (
				<>
					<GuestContact
						email={email}
						onEmailChange={onEmailChange}
						onEmailBlur={onEmailBlur}
						emailError={emailError}
						onSignInClick={onSignInClick}
						createAccount={createAccount}
						onCreateAccountChange={onCreateAccountChange}
						password={password}
						onPasswordChange={onPasswordChange}
						passwordError={passwordError}
					/>

					{/* Newsletter opt-in is disabled while the store has no newsletter.
					    To restore, uncomment this block and the commented code above.

					{!createAccount && (
						<div className="flex items-center gap-3">
							<Checkbox
								id="subscribe"
								checked={subscribeNews}
								onCheckedChange={(checked) => onSubscribeChange(checked === true)}
							/>
							<Label htmlFor="subscribe" className="cursor-pointer text-sm text-muted-foreground">
								Email me with news and offers
							</Label>
						</div>
					)}

					*/}
				</>
			)}
		</section>
	);
};
