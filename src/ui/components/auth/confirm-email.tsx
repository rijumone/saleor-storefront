"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { CheckCircle, Loader2, XCircle } from "lucide-react";

type Status = "confirming" | "success" | "error";

export function ConfirmEmail() {
	const params = useParams<{ channel: string }>();
	const searchParams = useSearchParams();
	const email = searchParams.get("email");
	const token = searchParams.get("token");
	const alreadyConfirmed = searchParams.get("confirmed") === "1";
	const hasConfirmationLink = Boolean(email && token);

	const [status, setStatus] = useState<Status>(
		alreadyConfirmed ? "success" : hasConfirmationLink ? "confirming" : "error",
	);
	const [error, setError] = useState(
		alreadyConfirmed || hasConfirmationLink
			? ""
			: "This confirmation link is missing information. Please sign in or create a new account.",
	);
	const started = useRef(false);

	useEffect(() => {
		if (started.current || alreadyConfirmed || !email || !token) {
			return;
		}
		started.current = true;

		void (async () => {
			try {
				const response = await fetch("/api/auth/confirm", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ email, token }),
				});

				const data = (await response.json()) as {
					errors?: Array<{ message: string }>;
					success?: boolean;
				};

				if (!response.ok || data.errors?.length) {
					setError(
						data.errors?.[0]?.message ||
							"This confirmation link is invalid or has expired. Please sign in or create a new account.",
					);
					setStatus("error");
					return;
				}

				setStatus("success");
				window.history.replaceState(null, "", `/${params.channel}/confirm-email?confirmed=1`);
			} catch {
				setError("An error occurred while confirming your email. Please try again.");
				setStatus("error");
			}
		})();
	}, [alreadyConfirmed, email, token, params.channel]);

	return (
		<div className="mx-auto my-16 w-full max-w-md">
			<div className="rounded-lg border border-border bg-card p-8 shadow-sm" aria-live="polite">
				{status === "confirming" && (
					<div className="flex flex-col items-center gap-4 text-center">
						<div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
							<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
						</div>
						<h1 className="text-2xl font-semibold">Confirming your email…</h1>
						<p className="text-muted-foreground">This will only take a moment.</p>
					</div>
				)}

				{status === "success" && (
					<div className="flex flex-col items-center gap-4 text-center" role="status">
						<div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
							<CheckCircle className="h-8 w-8 text-green-600" />
						</div>
						<h1 className="text-2xl font-semibold">Email confirmed!</h1>
						<p className="text-muted-foreground">
							Your email address has been verified. You can now sign in to your account.
						</p>
						<Link
							href={`/${params.channel}/login`}
							className="hover:bg-primary/90 mt-2 inline-flex h-12 w-full items-center justify-center rounded-md bg-primary px-4 text-base font-semibold text-primary-foreground transition-colors"
						>
							Sign in
						</Link>
					</div>
				)}

				{status === "error" && (
					<div className="flex flex-col items-center gap-4 text-center" role="alert">
						<div className="bg-destructive/10 flex h-16 w-16 items-center justify-center rounded-full">
							<XCircle className="h-8 w-8 text-destructive" />
						</div>
						<h1 className="text-2xl font-semibold">We couldn&apos;t confirm your email</h1>
						<p className="text-muted-foreground">{error}</p>
						<Link
							href={`/${params.channel}/login`}
							className="hover:bg-primary/90 mt-2 inline-flex h-12 w-full items-center justify-center rounded-md bg-primary px-4 text-base font-semibold text-primary-foreground transition-colors"
						>
							Back to sign in
						</Link>
						<Link
							href={`/${params.channel}/signup`}
							className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
						>
							Create a new account
						</Link>
					</div>
				)}
			</div>
		</div>
	);
}
