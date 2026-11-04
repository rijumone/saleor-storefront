import { Suspense } from "react";
import { seoTitle } from "@/lib/seo";
import { DeleteAccountConfirmation } from "@/ui/components/account/delete-account-confirmation";

export const metadata = {
	title: seoTitle("Delete Account"),
	robots: { index: false, follow: false },
};

export default function DeleteAccountPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
	return (
		<section className="mx-auto max-w-7xl p-8 pb-24">
			<Suspense fallback={null}>
				<DeleteAccountContent searchParams={searchParams} />
			</Suspense>
		</section>
	);
}

async function DeleteAccountContent({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
	const { token } = await searchParams;

	return <DeleteAccountConfirmation token={token ?? null} />;
}
