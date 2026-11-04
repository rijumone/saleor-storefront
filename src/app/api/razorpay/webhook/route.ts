import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import {
	completeCheckout,
	completeExistingCheckout,
	createCheckoutTransaction,
	getCheckoutPaymentState,
} from "@/lib/saleor-app";

interface RazorpayPayment {
	id: string;
	order_id: string;
	amount: number;
	currency: string;
	status: string;
	method?: string;
	notes?: unknown;
}

interface RazorpayOrder {
	id: string;
	amount: number;
	currency: string;
	notes?: unknown;
}

interface RazorpayWebhookEvent {
	event: string;
	payload?: {
		payment?: { entity?: RazorpayPayment };
	};
}

/**
 * Razorpay payment webhook.
 *
 * `payment.captured` is the source of truth for a successful payment. It
 * records a transaction on the Saleor checkout and completes it, so the order
 * is created fully paid instead of being completed by the browser.
 *
 * Delivery is unauthenticated at the HTTP level; trust comes from the
 * X-Razorpay-Signature HMAC over the raw body.
 */
export async function POST(request: Request) {
	const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

	if (!secret) {
		console.error("[razorpay webhook] RAZORPAY_WEBHOOK_SECRET is not configured");
		return NextResponse.json({ error: "Webhook secret is not configured" }, { status: 500 });
	}

	const rawBody = await request.text();
	const signature = request.headers.get("x-razorpay-signature");

	if (!signature || !isValidSignature(rawBody, signature, secret)) {
		console.error("[razorpay webhook] invalid signature");
		return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
	}

	let event: RazorpayWebhookEvent;

	try {
		event = JSON.parse(rawBody) as RazorpayWebhookEvent;
	} catch {
		return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
	}

	if (event.event !== "payment.captured") {
		console.log(`[razorpay webhook] ignored event ${event.event}`);
		return NextResponse.json({ received: true, ignored: event.event });
	}

	const payment = event.payload?.payment?.entity;

	if (!payment) {
		return NextResponse.json({ error: "Missing payment entity" }, { status: 400 });
	}

	if (payment.status !== "captured") {
		console.log(`[razorpay webhook] payment ${payment.id} is ${payment.status}; ignoring`);
		return NextResponse.json({ received: true, ignored: payment.status });
	}

	try {
		const result = await recordCapturedPayment(payment);
		return NextResponse.json({ received: true, ...result });
	} catch (error) {
		// Returning 5xx makes Razorpay retry, which is what we want for transient
		// Saleor failures. The transaction recording is idempotent by payment id.
		console.error(`[razorpay webhook] failed to process payment ${payment.id}:`, error);
		return NextResponse.json({ error: "Failed to record payment" }, { status: 500 });
	}
}

function isValidSignature(rawBody: string, signature: string, secret: string): boolean {
	const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
	const expectedBuffer = Buffer.from(expected);
	const signatureBuffer = Buffer.from(signature);

	if (expectedBuffer.length !== signatureBuffer.length) {
		return false;
	}

	return timingSafeEqual(expectedBuffer, signatureBuffer);
}

async function recordCapturedPayment(payment: RazorpayPayment) {
	const checkoutId = await resolveCheckoutId(payment);
	const checkout = await getCheckoutPaymentState(checkoutId);

	if (!checkout) {
		// A retry after the browser (or an earlier delivery) completed the checkout.
		// Saleor returns the existing order; only report success if it is paid.
		const existing = await completeExistingCheckout(checkoutId);

		if (existing?.paymentStatus === "FULLY_CHARGED") {
			return { orderId: existing.id, orderNumber: existing.number, duplicate: true };
		}

		throw new Error(`Saleor checkout ${checkoutId} was not found.`);
	}

	assertAmountMatches(payment, checkout);

	// The app token cannot read checkout.transactions without MANAGE_CHECKOUTS.
	// A fully charged checkout means a payment (this one, on a retry) has already
	// been recorded, so recording again would double-count it.
	const alreadyRecorded = checkout.chargeStatus === "FULL";

	if (!alreadyRecorded) {
		if (checkout.chargeStatus !== "NONE") {
			throw new Error(
				`Checkout ${checkoutId} is in charge state ${checkout.chargeStatus}; refusing to record payment ${payment.id}.`,
			);
		}

		await createCheckoutTransaction({
			checkoutId,
			pspReference: payment.id,
			amount: Number((payment.amount / 100).toFixed(2)),
			currency: payment.currency,
			method: payment.method,
		});
	}

	// checkoutComplete is idempotent: if the browser's finalize call already
	// created the order, Saleor returns the existing order.
	const order = await completeCheckout(checkoutId);

	console.log(
		`[razorpay webhook] payment ${payment.id} recorded on checkout ${checkoutId}; order ${order.number}`,
	);

	return { orderId: order.id, orderNumber: order.number, duplicate: alreadyRecorded };
}

async function resolveCheckoutId(payment: RazorpayPayment): Promise<string> {
	const paymentNotes = readNotes(payment.notes);

	if (paymentNotes?.saleor_checkout_id) {
		return paymentNotes.saleor_checkout_id;
	}

	const order = await fetchRazorpayOrder(payment.order_id);
	const orderNotes = readNotes(order.notes);

	if (!orderNotes?.saleor_checkout_id) {
		throw new Error(
			`Razorpay order ${payment.order_id} has no saleor_checkout_id note. ` +
				"The payment cannot be linked to a Saleor checkout.",
		);
	}

	return orderNotes.saleor_checkout_id;
}

function readNotes(notes: unknown): Record<string, string> | undefined {
	if (!notes || typeof notes !== "object" || Array.isArray(notes)) {
		return undefined;
	}

	return notes as Record<string, string>;
}

async function fetchRazorpayOrder(orderId: string): Promise<RazorpayOrder> {
	const keyId = process.env.RAZORPAY_KEY_ID;
	const keySecret = process.env.RAZORPAY_KEY_SECRET;

	if (!keyId || !keySecret) {
		throw new Error("Razorpay API keys are not configured.");
	}

	const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
	const response = await fetch(`https://api.razorpay.com/v1/orders/${orderId}`, {
		headers: { Authorization: `Basic ${auth}` },
		cache: "no-store",
	});

	if (!response.ok) {
		throw new Error(`Razorpay order ${orderId} lookup failed with ${response.status}.`);
	}

	return (await response.json()) as RazorpayOrder;
}

function assertAmountMatches(
	payment: RazorpayPayment,
	checkout: { totalPrice: { gross: { amount: number; currency: string } } },
) {
	const expectedAmount = Math.round(checkout.totalPrice.gross.amount * 100);
	const expectedCurrency = checkout.totalPrice.gross.currency;

	if (payment.amount !== expectedAmount || payment.currency !== expectedCurrency) {
		throw new Error(
			`Payment ${payment.id} is ${payment.amount} ${payment.currency}, but the checkout expects ` +
				`${expectedAmount} ${expectedCurrency}.`,
		);
	}
}
