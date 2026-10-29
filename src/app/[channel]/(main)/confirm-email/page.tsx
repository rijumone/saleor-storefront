import { Suspense } from "react";
import { ConfirmEmail } from "@/ui/components/auth/confirm-email";
import { seoTitle } from "@/lib/seo";

export const metadata = {
	title: seoTitle("Confirm Email"),
	description: "Confirm your email address to activate your account.",
	robots: { index: false, follow: false },
};

export default function ConfirmEmailPage() {
	return (
		<section className="mx-auto max-w-7xl p-8 pb-24">
			<Suspense fallback={<ConfirmEmailSkeleton />}>
				<ConfirmEmail />
			</Suspense>
		</section>
	);
}

function ConfirmEmailSkeleton() {
	return (
		<div className="mx-auto my-16 w-full max-w-md">
			<div className="rounded-lg border border-border bg-card p-8 shadow-sm">
				<div className="flex flex-col items-center gap-4">
					<div className="h-16 w-16 animate-pulse rounded-full bg-secondary" />
					<div className="h-7 w-48 animate-pulse rounded bg-secondary" />
					<div className="h-4 w-64 animate-pulse rounded bg-secondary" />
					<div className="h-12 w-full animate-pulse rounded-md bg-secondary" />
				</div>
			</div>
		</div>
	);
}
