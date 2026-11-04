"use client";

import { useState, useTransition, useRef, useCallback } from "react";
import { Button } from "@/ui/components/ui/button";
import { PasswordInput } from "@/ui/components/ui/password-input";
import { Label } from "@/ui/components/ui/label";
import { changePassword } from "@/app/[channel]/(main)/account/actions";

export function ChangePasswordForm() {
	const [isOpen, setIsOpen] = useState(false);
	const [isPending, startTransition] = useTransition();
	const [error, setError] = useState("");
	const [success, setSuccess] = useState(false);
	const formRef = useRef<HTMLFormElement>(null);

	const handleSubmit = useCallback(
		(formData: FormData) => {
			setError("");
			setSuccess(false);

			startTransition(async () => {
				const result = await changePassword(formData);
				if (!result.success) {
					setError(result.error);
				} else {
					setSuccess(true);
					setIsOpen(false);
					formRef.current?.reset();
				}
			});
		},
		[startTransition],
	);

	if (!isOpen) {
		return (
			<div className="flex items-center justify-between">
				<div>
					<p className="text-sm text-muted-foreground">Password</p>
					<p className="font-medium">••••••••</p>
				</div>
				<div className="flex items-center gap-2">
					{success && (
						<span aria-live="polite" className="text-sm text-green-600">
							Updated
						</span>
					)}
					<Button variant="ghost" size="sm" onClick={() => setIsOpen(true)}>
						Change
					</Button>
				</div>
			</div>
		);
	}

	return (
		<form ref={formRef} action={handleSubmit} className="space-y-4">
			<p className="text-sm text-muted-foreground">Password</p>
			{error && (
				<p role="alert" className="text-sm text-destructive">
					{error}
				</p>
			)}

			<div className="space-y-1.5">
				<Label htmlFor="oldPassword">Current password</Label>
				<PasswordInput id="oldPassword" name="oldPassword" autoComplete="current-password" required />
			</div>

			<div className="space-y-1.5">
				<Label htmlFor="newPassword">New password</Label>
				<PasswordInput
					id="newPassword"
					name="newPassword"
					autoComplete="new-password"
					placeholder="At least 8 characters…"
					minLength={8}
					required
				/>
			</div>

			<div className="space-y-1.5">
				<Label htmlFor="confirmPassword">Confirm new password</Label>
				<PasswordInput
					id="confirmPassword"
					name="confirmPassword"
					autoComplete="new-password"
					placeholder="Re-enter your new password"
					minLength={8}
					required
				/>
			</div>

			<div className="flex gap-2">
				<Button type="submit" size="sm" disabled={isPending}>
					{isPending ? "Changing…" : "Change password"}
				</Button>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					onClick={() => {
						setIsOpen(false);
						setError("");
						formRef.current?.reset();
					}}
				>
					Cancel
				</Button>
			</div>
		</form>
	);
}
