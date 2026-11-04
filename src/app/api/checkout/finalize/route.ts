import { NextResponse } from "next/server";

import { completeCheckout, completeExistingCheckout, getCheckoutPaymentState } from "@/lib/saleor-app";

const POLL_INTERVAL_MS = 1_000;
const POLL_TIMEOUT_MS = 30_000;

/**
 * Called by the browser after Razorpay reports success.
 *
 * The webhook records the payment on the checkout. This endpoint waits for that
 * to happen, then completes the checkout. It never records a payment itself, so
 * a browser cannot complete an unpaid order.
 */
export async function POST(request: Request) {
	let body: { checkoutId?: unknown };

	try {
		body = (await request.json()) as { checkoutId?: unknown };
	} catch {
		return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
	}

	const checkoutId = body.checkoutId;

	if (typeof checkoutId !== "string" || checkoutId.length === 0) {
		return NextResponse.json({ error: "checkoutId is required" }, { status: 400 });
	}

	const deadline = Date.now() + POLL_TIMEOUT_MS;

	while (Date.now() < deadline) {
		try {
			const checkout = await getCheckoutPaymentState(checkoutId);

			if (!checkout) {
				// The webhook may have completed the checkout before this request
				// arrived. Saleor returns the existing order for a completed checkout.
				const existing = await completeExistingCheckout(checkoutId);

				if (existing?.paymentStatus === "FULLY_CHARGED") {
					return NextResponse.json({
						orderId: existing.id,
						orderNumber: existing.number,
						paymentStatus: existing.paymentStatus,
						chargeStatus: existing.chargeStatus,
					});
				}

				return NextResponse.json({ error: "Checkout not found" }, { status: 404 });
			}

			if (checkout.chargeStatus === "FULL") {
				const order = await completeCheckout(checkoutId);
				return NextResponse.json({
					orderId: order.id,
					orderNumber: order.number,
					paymentStatus: order.paymentStatus,
					chargeStatus: order.chargeStatus,
				});
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);

			// A malformed or unknown id will never become valid; fail fast.
			if (/invalid id|couldn't resolve|not found/i.test(message)) {
				return NextResponse.json({ error: "Checkout not found" }, { status: 404 });
			}

			// A transient Saleor error should not abort the poll; retry until the
			// deadline, then report that the payment is still confirming.
			console.error(`[checkout finalize] poll failed for ${checkoutId}:`, error);
		}

		await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
	}

	console.error(`[checkout finalize] timed out waiting for payment on ${checkoutId}`);
	return NextResponse.json(
		{ error: "Payment is still being confirmed. Please wait a moment and retry.", status: "pending" },
		{ status: 409 },
	);
}
