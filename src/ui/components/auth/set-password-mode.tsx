"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { CheckCircle } from "lucide-react";
import { Button } from "@/ui/components/ui/button";
import { PasswordInput } from "@/ui/components/ui/password-input";
import { Label } from "@/ui/components/ui/label";

type Props = {
	email: string;
	token: string;
};

export function SetPasswordMode({ email, token }: Props) {
	const router = useRouter();
	const params = useParams<{ channel: string }>();

	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");

		if (!password) {
			setError("Please enter a new password");
			return;
		}

		if (password.length < 8) {
			setError("Password must be at least 8 characters");
			return;
		}

		if (password !== confirmPassword) {
			setError("Passwords do not match");
			return;
		}

		setIsSubmitting(true);

		try {
			const response = await fetch("/api/auth/set-password", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email, token, password }),
			});

			const data = (await response.json()) as {
				errors?: Array<{ message: string; code?: string }>;
				success?: boolean;
			};

			if (data.errors?.length) {
				const err = data.errors[0];
				if (err.code === "INVALID_TOKEN" || err.message?.includes("token")) {
					setError("This password reset link has expired. Please request a new one.");
				} else {
					setError(err.message || "Failed to set password");
				}
				return;
			}

			if (data.success) {
				setSuccess(true);
				setTimeout(() => {
					router.push(`/${params.channel}/login`);
					router.refresh();
				}, 2000);
			}
		} catch {
			setError("An error occurred. Please try again.");
		} finally {
			setIsSubmitting(false);
		}
	};

	if (success) {
		return (
			<div className="mx-auto my-16 w-full max-w-md">
				<div className="rounded-lg border border-border bg-card p-8 shadow-sm">
					<div className="flex flex-col items-center gap-4 text-center">
						<div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
							<CheckCircle className="h-8 w-8 text-green-600" />
						</div>
						<h1 className="text-2xl font-semibold">Password Updated!</h1>
						<p className="text-muted-foreground">
							Your password has been successfully reset. Please sign in with your new password.
						</p>
						<p className="text-sm text-muted-foreground">Redirecting you to sign in…</p>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="mx-auto my-16 w-full max-w-md">
			<div className="rounded-lg border border-border bg-card p-8 shadow-sm">
				<div className="mb-6 text-center">
					<h1 className="text-2xl font-semibold">Set New Password</h1>
					<p className="mt-2 text-sm text-muted-foreground">
						Enter a new password for <span className="font-medium">{email}</span>
					</p>
				</div>

				<form onSubmit={handleSubmit} className="space-y-4">
					{error && (
						<div role="alert" className="bg-destructive/10 rounded-md p-3 text-sm text-destructive">
							{error}
						</div>
					)}

					<div className="space-y-1.5">
						<Label htmlFor="password" className="text-sm font-medium">
							New Password
						</Label>
						<PasswordInput
							id="password"
							placeholder="At least 8 characters…"
							autoComplete="new-password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							className="h-12"
							required
						/>
					</div>

					<div className="space-y-1.5">
						<Label htmlFor="confirmPassword" className="text-sm font-medium">
							Confirm Password
						</Label>
						<PasswordInput
							id="confirmPassword"
							placeholder="Confirm your password"
							autoComplete="new-password"
							value={confirmPassword}
							onChange={(e) => setConfirmPassword(e.target.value)}
							className="h-12"
							required
						/>
					</div>

					<Button type="submit" disabled={isSubmitting} className="h-12 w-full text-base font-semibold">
						{isSubmitting ? "Updating…" : "Update Password"}
					</Button>

					<div className="text-center">
						<Link
							href={`/${params.channel}/login`}
							className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground hover:no-underline"
						>
							Back to Sign In
						</Link>
					</div>
				</form>
			</div>
		</div>
	);
}
