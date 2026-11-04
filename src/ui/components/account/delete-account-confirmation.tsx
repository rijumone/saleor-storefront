"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/ui/components/ui/button";
import { deleteAccount } from "@/app/[channel]/(main)/account/actions";
import { logout } from "@/app/actions";

type Props = {
	token: string | null;
};

export function DeleteAccountConfirmation({ token }: Props) {
	const params = useParams<{ channel: string }>();
	const router = useRouter();
	const [isPending, startTransition] = useTransition();
	const [error, setError] = useState("");

	const handleDelete = () => {
		if (!token || isPending) return;

		setError("");
		startTransition(async () => {
			const result = await deleteAccount(token);

			if (!result.success) {
				setError(result.error);
				return;
			}

			try {
				await logout();
			} catch {
				// The account is already gone; a full navigation below will clear the stale session view.
			}

			router.push(`/${params.channel}`);
			router.refresh();
		});
	};

	if (!token) {
		return (
			<div className="mx-auto my-16 w-full max-w-md">
				<div className="rounded-lg border border-border bg-card p-8 text-center shadow-sm">
					<div className="bg-destructive/10 mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full">
						<AlertTriangle className="h-6 w-6 text-destructive" />
					</div>
					<h1 className="text-2xl font-semibold">Invalid deletion link</h1>
					<p className="mt-2 text-sm text-muted-foreground">
						This link is missing its token or has expired. Request a new deletion email from Settings.
					</p>
					<Link
						href={`/${params.channel}/account/settings`}
						className="mt-6 inline-block text-sm font-medium text-foreground underline underline-offset-2 hover:no-underline"
					>
						Back to settings
					</Link>
				</div>
			</div>
		);
	}

	return (
		<div className="mx-auto my-16 w-full max-w-md">
			<div className="rounded-lg border border-border bg-card p-8 shadow-sm">
				<div className="bg-destructive/10 mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full">
					<AlertTriangle className="h-6 w-6 text-destructive" />
				</div>
				<h1 className="text-center text-2xl font-semibold">Delete your account?</h1>
				<p className="mt-2 text-center text-sm text-muted-foreground">
					This will permanently delete your account and all associated data. This cannot be undone.
				</p>

				{error && (
					<p role="alert" className="bg-destructive/10 mt-4 rounded-md p-3 text-sm text-destructive">
						{error}
					</p>
				)}

				<div className="mt-6 flex flex-col gap-2">
					<Button
						type="button"
						variant="destructive"
						onClick={handleDelete}
						disabled={isPending}
						className="h-12 w-full text-base font-semibold"
					>
						{isPending ? "Deleting…" : "Yes, delete my account"}
					</Button>
					<Button
						type="button"
						variant="ghost"
						onClick={() => router.push(`/${params.channel}/account/settings`)}
						disabled={isPending}
					>
						Cancel
					</Button>
				</div>
			</div>
		</div>
	);
}
