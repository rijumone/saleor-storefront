"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { LoginMode } from "./auth/login-mode";
import { SetPasswordMode } from "./auth/set-password-mode";

export function LoginForm() {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const email = searchParams.get("email");
	const resetToken = searchParams.get("token");

	if (email && resetToken) {
		return <SetPasswordMode email={email} token={resetToken} />;
	}

	// The login route can be kept mounted while the user visits sign-up, so key
	// the form by route and prefilled email to clear stale state on return.
	return <LoginMode key={`${pathname}:${email ?? ""}`} initialEmail={email ?? ""} />;
}
