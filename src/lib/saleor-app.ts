import "server-only";

/**
 * Server-side Saleor access using the payment-confirm app token.
 *
 * This module must never be imported from a client component: the token is a
 * privileged credential with HANDLE_PAYMENTS. `server-only` turns an accidental
 * client import into a build error.
 */

interface GraphQLResponse<T> {
	data?: T;
	errors?: Array<{ message: string }>;
}

export interface CheckoutPaymentState {
	id: string;
	chargeStatus: string;
	totalPrice: { gross: { amount: number; currency: string } };
}

export interface CompletedOrder {
	id: string;
	number: string;
	paymentStatus: string;
	chargeStatus: string;
}

const CHECKOUT_PAYMENT_STATE_QUERY = /* GraphQL */ `
	query CheckoutPaymentState($id: ID!) {
		checkout(id: $id) {
			id
			chargeStatus
			totalPrice {
				gross {
					amount
					currency
				}
			}
		}
	}
`;

const TRANSACTION_CREATE_MUTATION = /* GraphQL */ `
	mutation CreateCheckoutTransaction(
		$id: ID!
		$transaction: TransactionCreateInput!
		$transactionEvent: TransactionEventInput
	) {
		transactionCreate(id: $id, transaction: $transaction, transactionEvent: $transactionEvent) {
			transaction {
				id
				pspReference
				chargedAmount {
					amount
					currency
				}
			}
			errors {
				field
				message
				code
			}
		}
	}
`;

const CHECKOUT_COMPLETE_MUTATION = /* GraphQL */ `
	mutation CompleteCheckout($checkoutId: ID!) {
		checkoutComplete(checkoutId: $checkoutId) {
			order {
				id
				number
				paymentStatus
				chargeStatus
			}
			errors {
				field
				message
				code
			}
		}
	}
`;

function getApiUrl(): string {
	const url = process.env.SALEOR_API_URL ?? process.env.NEXT_PUBLIC_SALEOR_API_URL;
	if (!url) {
		throw new Error("Missing SALEOR_API_URL or NEXT_PUBLIC_SALEOR_API_URL.");
	}
	return url;
}

function getAppToken(): string {
	const token = process.env.SALEOR_APP_TOKEN;
	if (!token) {
		throw new Error("Missing SALEOR_APP_TOKEN.");
	}
	return token;
}

export async function saleorAppRequest<T>(
	query: string,
	variables: Record<string, unknown> = {},
): Promise<T> {
	const response = await fetch(getApiUrl(), {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${getAppToken()}`,
		},
		body: JSON.stringify({ query, variables }),
		cache: "no-store",
	});

	if (!response.ok) {
		throw new Error(`Saleor responded ${response.status} ${response.statusText}.`);
	}

	const payload = (await response.json()) as GraphQLResponse<T>;

	if (payload.errors?.length) {
		throw new Error(`Saleor GraphQL error: ${payload.errors.map((error) => error.message).join("; ")}`);
	}

	if (!payload.data) {
		throw new Error("Saleor returned no data.");
	}

	return payload.data;
}

export async function getCheckoutPaymentState(checkoutId: string): Promise<CheckoutPaymentState | null> {
	const data = await saleorAppRequest<{ checkout: CheckoutPaymentState | null }>(
		CHECKOUT_PAYMENT_STATE_QUERY,
		{ id: checkoutId },
	);
	return data.checkout;
}

export async function createCheckoutTransaction(input: {
	checkoutId: string;
	pspReference: string;
	amount: number;
	currency: string;
	method?: string;
}): Promise<void> {
	const data = await saleorAppRequest<{
		transactionCreate: {
			transaction: { id: string } | null;
			errors: Array<{ field: string | null; message: string | null; code: string }>;
		};
	}>(TRANSACTION_CREATE_MUTATION, {
		id: input.checkoutId,
		transaction: {
			name: "Razorpay",
			pspReference: input.pspReference,
			amountCharged: { amount: input.amount, currency: input.currency },
			message: input.method ? `Razorpay ${input.method} payment` : "Razorpay payment",
		},
		transactionEvent: {
			pspReference: input.pspReference,
			message: "Payment captured",
		},
	});

	const { errors } = data.transactionCreate;

	if (errors.length) {
		throw new Error(
			`transactionCreate failed: ${errors
				.map((error) => `${error.field ?? "?"}: ${error.message}`)
				.join(", ")}`,
		);
	}
}

export async function completeCheckout(checkoutId: string): Promise<CompletedOrder> {
	const data = await saleorAppRequest<{
		checkoutComplete: {
			order: CompletedOrder | null;
			errors: Array<{ field: string | null; message: string | null; code: string }>;
		};
	}>(CHECKOUT_COMPLETE_MUTATION, { checkoutId });

	const { order, errors } = data.checkoutComplete;

	if (errors.length) {
		throw new Error(
			`checkoutComplete failed: ${errors
				.map((error) => `${error.field ?? "?"}: ${error.message}`)
				.join(", ")}`,
		);
	}

	if (!order) {
		throw new Error("checkoutComplete returned no order.");
	}

	return order;
}

/**
 * Completes a checkout that may already have been completed by the webhook.
 * Saleor returns the existing order for an already-completed checkout, so this
 * is safe to call as a fallback. Returns null when the id is invalid or the
 * checkout is not in a completable state.
 */
export async function completeExistingCheckout(checkoutId: string): Promise<CompletedOrder | null> {
	try {
		return await completeCheckout(checkoutId);
	} catch {
		return null;
	}
}
