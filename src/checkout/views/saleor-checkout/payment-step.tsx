"use client";

import { useState, useEffect, useCallback, type FC } from "react";
import { ChevronLeft, AlertCircle } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/ui/components/ui/button";
import { CheckoutSummaryContext, buildPaymentSummaryRows } from "./checkout-summary-context";
import {
	type CheckoutFragment,
	type CountryCode,
	type AddressFragment,
	useCheckoutBillingAddressUpdateMutation,
	useTransactionInitializeMutation,
	useCheckoutCompleteMutation,
} from "@/checkout/graphql";
import { useCheckout } from "@/checkout/hooks/use-checkout";
import { useUser } from "@/checkout/hooks/use-user";
import { getAddressInputData } from "@/checkout/components/address-form/utils";
// Dummy payment gateway ID (from Saleor Dummy Payment app)
const dummyGatewayId = "mirumee.payments.dummy";
import { createQueryString } from "@/checkout/lib/utils/url";
import { localeConfig } from "@/config/locale";
import { MobileStickyAction } from "./mobile-sticky-action";
import { getStepNumber } from "./flow";

// Extracted reusable components
import {
	PaymentMethodSelector,
	BillingAddressSection,
	type PaymentMethodType,
	type CardData,
	type BillingAddressData,
	isCardDataValid,
} from "@/checkout/components/payment";
import { LoadingSpinner } from "@/checkout/ui-kit/loading-spinner";
import { formatMoneyWithFallback } from "@/checkout/lib/utils/money";

interface PaymentStepProps {
	checkout: CheckoutFragment;
	onBack: () => void;
	onComplete: () => void;
	onGoToInformation?: () => void;
}

export const PaymentStep: FC<PaymentStepProps> = ({
	checkout: initialCheckout,
	onBack,
	onComplete,
	onGoToInformation,
}) => {
	const router = useRouter();
	const searchParams = useSearchParams();
	// Use live checkout data to ensure we have the latest total (including shipping)
	const { checkout: liveCheckout } = useCheckout();
	const checkout = liveCheckout || initialCheckout;

	// Get user data for saved addresses
	const { user, authenticated } = useUser();

	// For digital products, there's no shipping address, so can't use "same as billing"
	const isShippingRequired = checkout.isShippingRequired;
	const hasShippingAddress = !!checkout.shippingAddress;

	// Payment method state
	const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>("card");
	// Lazy initialization - object only created once on mount
	const [cardData, setCardData] = useState<CardData>(() => ({
		cardNumber: "",
		expiry: "",
		cvc: "",
		nameOnCard: "",
	}));

	// Billing address state
	const [sameAsBilling, setSameAsBilling] = useState(isShippingRequired && hasShippingAddress);
	// Lazy initialization - complex object only created once on mount
	const [billingData, setBillingData] = useState<BillingAddressData>(() => ({
		countryCode: (checkout.billingAddress?.country?.code as CountryCode) || "US",
		formData: {
			firstName: checkout.billingAddress?.firstName || "",
			lastName: checkout.billingAddress?.lastName || "",
			streetAddress1: checkout.billingAddress?.streetAddress1 || "",
			streetAddress2: checkout.billingAddress?.streetAddress2 || "",
			companyName: checkout.billingAddress?.companyName || "",
			city: checkout.billingAddress?.city || "",
			postalCode: checkout.billingAddress?.postalCode || "",
			countryArea: checkout.billingAddress?.countryArea || "",
			phone: checkout.billingAddress?.phone || "",
		},
	}));

	// Sync billing address from server state
	useEffect(() => {
		const billing = checkout.billingAddress;
		if (billing) {
			setBillingData((prev) => ({
				...prev,
				countryCode: (billing.country?.code as CountryCode) || "US",
				formData: {
					firstName: billing.firstName || "",
					lastName: billing.lastName || "",
					streetAddress1: billing.streetAddress1 || "",
					streetAddress2: billing.streetAddress2 || "",
					companyName: billing.companyName || "",
					city: billing.city || "",
					postalCode: billing.postalCode || "",
					countryArea: billing.countryArea || "",
					cityArea: billing.cityArea || "",
					phone: billing.phone || "",
				},
			}));
		}
	}, [checkout.billingAddress]);

	const [isProcessing, setIsProcessing] = useState(false);
	const [errors, setErrors] = useState<Record<string, string>>({});

	// Mutations
	const [, updateBillingAddress] = useCheckoutBillingAddressUpdateMutation();
	const [transactionState, transactionInitialize] = useTransactionInitializeMutation();
	const [completeState, checkoutComplete] = useCheckoutCompleteMutation();

	// Check for available payment gateways
	const availableGateways = checkout.availablePaymentGateways || [];
	const hasDummyGateway = availableGateways.some((g) => g.id === dummyGatewayId);
	const hasRealGateway = availableGateways.some((g) => g.id !== dummyGatewayId);

	const shippingAddress = checkout.shippingAddress;

	// Memoize billing data handler to avoid infinite loops
	const handleBillingDataChange = useCallback((data: BillingAddressData) => {
		setBillingData(data);
	}, []);

	// Summary rows for context display
	const summaryRows = buildPaymentSummaryRows(checkout);

	// Handle step navigation from summary
	const handleGoToStep = (step: number) => {
		if (step === 1 && onGoToInformation) {
			onGoToInformation();
		} else if (step === 2) {
			onBack();
		}
	};

	const total = checkout.totalPrice?.gross;
	const totalStr = formatMoneyWithFallback(total);

	const handleSubmit = useCallback(
		async (event?: React.FormEvent) => {
			if (event) {
				event.preventDefault();
			}

			setErrors({});

			// Validate billing address if different from shipping (or for digital products)
			const needsBillingForm = !sameAsBilling || !hasShippingAddress;

			setIsProcessing(true);
			try {
				// Update billing address
				if (needsBillingForm) {
					let addressInput;

					// Check if user selected a saved address
					if (billingData.selectedAddressId && user?.addresses) {
						const selectedAddress = user.addresses.find((addr) => addr.id === billingData.selectedAddressId);
						if (selectedAddress) {
							addressInput = getAddressInputData({
								firstName: selectedAddress.firstName || "",
								lastName: selectedAddress.lastName || "",
								streetAddress1: selectedAddress.streetAddress1 || "",
								streetAddress2: selectedAddress.streetAddress2 || "",
								companyName: selectedAddress.companyName || "",
								city: selectedAddress.city || "",
								postalCode: selectedAddress.postalCode || "",
								countryArea: selectedAddress.countryArea || "",
								phone: selectedAddress.phone || "",
								countryCode: selectedAddress.country?.code as CountryCode,
							});
						}
					}

					// If no saved address selected, use form data
					if (!addressInput) {
						addressInput = getAddressInputData({
							...billingData.formData,
							countryCode: billingData.countryCode,
						});
					}

					const result = await updateBillingAddress({
						checkoutId: checkout.id,
						billingAddress: addressInput,
						languageCode: localeConfig.graphqlLanguageCode,
					});
					if (result.error) {
						setErrors({ streetAddress1: "Failed to update billing address" });
						return;
					}
					const billingErrors = result.data?.checkoutBillingAddressUpdate?.errors;
					if (billingErrors?.length) {
						const errorMap: Record<string, string> = {};
						billingErrors.forEach((err) => {
							const field = err.field || "streetAddress1";
							errorMap[field] = err.message || "Invalid value";
						});
						setErrors(errorMap);
						const firstField = Object.keys(errorMap)[0];
						const element = document.querySelector(`[name="${firstField}"]`) as HTMLElement;
						element?.focus();
						return;
					}
				} else if (shippingAddress) {
					// Copy shipping address to billing
					const addressInput = getAddressInputData({
						firstName: shippingAddress.firstName || "",
						lastName: shippingAddress.lastName || "",
						streetAddress1: shippingAddress.streetAddress1 || "",
						streetAddress2: shippingAddress.streetAddress2 || "",
						companyName: shippingAddress.companyName || "",
						city: shippingAddress.city || "",
						postalCode: shippingAddress.postalCode || "",
						countryArea: shippingAddress.countryArea || "",
						phone: shippingAddress.phone || "",
						countryCode: shippingAddress.country?.code as CountryCode,
					});
					await updateBillingAddress({
						checkoutId: checkout.id,
						billingAddress: addressInput,
						languageCode: localeConfig.graphqlLanguageCode,
					});
				}

				// Process payment using available gateway
				if (paymentMethod === "razorpay") {
					// 1. Call Next.js API to create Razorpay Order
					const response = await fetch("/api/razorpay", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							amount: checkout.totalPrice?.gross?.amount || 0,
							currency: checkout.totalPrice?.gross?.currency || "INR",
							receipt: checkout.id.substring(0, 40),
						}),
					});

					const order: any = await response.json();
					if (!response.ok) {
						setErrors({ payment: order.error || "Failed to create Razorpay order" });
						return;
					}

					// 2. Load Razorpay script
					const scriptLoaded = await new Promise((resolve) => {
						if ((window as any).Razorpay) {
							resolve(true);
							return;
						}
						const script = document.createElement("script");
						script.src = "https://checkout.razorpay.com/v1/checkout.js";
						script.onload = () => resolve(true);
						script.onerror = () => resolve(false);
						document.body.appendChild(script);
					});

					if (!scriptLoaded) {
						setErrors({ payment: "Failed to load Razorpay SDK" });
						return;
					}

					// 3. Open Razorpay widget
					const options = {
						key: order.key_id,
						amount: order.amount,
						currency: order.currency,
						name: "Rijuvenation",
						description: "Order Checkout",
						order_id: order.id,
						handler: async function (_paymentResponse: any) {
							// On success, complete Saleor checkout
							try {
								setIsProcessing(true);
								if (hasDummyGateway) {
									const initResult = await transactionInitialize({
										checkoutId: checkout.id,
										action: "CHARGE" as any,
										amount: checkout.totalPrice?.gross?.amount,
										paymentGateway: {
											id: dummyGatewayId,
											data: {
												event: { includePspReference: true, type: "CHARGE_SUCCESS" },
											},
										},
									});

									if (initResult.error || initResult.data?.transactionInitialize?.errors?.length) {
										const errors = initResult.data?.transactionInitialize?.errors;
										const errorMessage = errors?.length
											? errors.map((e) => `${e.field}: ${e.message} (${e.code})`).join(", ")
											: initResult.error?.message || "Unknown error";
										console.error("Saleor transaction init failed:", initResult.error, errors);
										throw new Error(`Saleor transaction init failed: ${errorMessage}`);
									}
								}

								const completeResult = await checkoutComplete({ checkoutId: checkout.id });
								if (completeResult.error || completeResult.data?.checkoutComplete?.errors?.length) {
									throw new Error(
										completeResult.data?.checkoutComplete?.errors?.[0]?.message ||
											"Saleor checkout complete failed",
									);
								}

								const saleorOrder = completeResult.data?.checkoutComplete?.order;
								if (saleorOrder) {
									const newQuery = createQueryString(searchParams, { orderId: saleorOrder.id });
									router.replace(`?${newQuery}`, { scroll: false });
								} else {
									onComplete();
								}
							} catch (err: any) {
								setErrors({ payment: err.message || "Failed to complete order in Saleor" });
							} finally {
								setIsProcessing(false);
							}
						},
						prefill: {
							name: billingData.formData.firstName + " " + billingData.formData.lastName,
							email: user?.email || checkout.email,
							contact: billingData.formData.phone,
						},
						theme: {
							color: "#000000",
						},
					};

					const paymentObject = new (window as any).Razorpay(options);
					paymentObject.on("payment.failed", function (failResponse: any) {
						setErrors({ payment: failResponse.error.description });
					});
					paymentObject.open();
					return;
				} else if (hasDummyGateway) {
					const checkoutId = checkout.id;

					const initResult = await transactionInitialize({
						checkoutId,
						action: "CHARGE" as any,
						amount: checkout.totalPrice?.gross?.amount,
						paymentGateway: {
							id: dummyGatewayId,
							data: {
								event: {
									includePspReference: true,
									type: "CHARGE_SUCCESS",
								},
							},
						},
					});

					if (initResult.error) {
						console.error("Payment initialization error:", initResult.error);
						setErrors({ payment: `Payment initialization error: ${initResult.error.message}` });
						return;
					}

					const transactionErrors = initResult.data?.transactionInitialize?.errors;
					if (transactionErrors?.length) {
						const errorMessage = transactionErrors
							.map((e) => `${e.field}: ${e.message} (${e.code})`)
							.join(", ");
						console.error("Transaction errors:", transactionErrors);
						setErrors({ payment: `Payment failed: ${errorMessage}` });
						return;
					}

					// Complete the checkout and create the order
					const completeResult = await checkoutComplete({
						checkoutId,
					});

					if (completeResult.error) {
						console.error("Checkout complete error:", completeResult.error);
						setErrors({ streetAddress1: "Failed to complete order. Please try again." });
						return;
					}

					const completeErrors = completeResult.data?.checkoutComplete?.errors;
					if (completeErrors?.length) {
						const errorDetails = completeErrors.map((e) => `${e.field}: ${e.message} (${e.code})`).join(", ");
						console.error("Checkout complete errors:", errorDetails, completeErrors);
						// Show a more descriptive error
						const firstError = completeErrors[0];
						const errorMessage = firstError.message || firstError.code || "Failed to complete order";
						setErrors({ payment: errorMessage });
						return;
					}

					// Redirect to order confirmation
					const order = completeResult.data?.checkoutComplete?.order;
					if (order) {
						const newQuery = createQueryString(searchParams, { orderId: order.id });
						router.replace(`?${newQuery}`, { scroll: false });
						return;
					}
				} else if (!hasRealGateway) {
					// No payment gateway configured
					setErrors({
						streetAddress1:
							"No payment gateway configured. Please contact support or configure a payment app in Saleor.",
					});
					return;
				} else {
					// Real payment gateway - this UI doesn't support it yet
					// For now, show an error
					setErrors({
						streetAddress1:
							"This checkout UI currently only supports test payments. Please use the standard checkout for real payments.",
					});
					return;
				}

				onComplete();
			} catch (err: any) {
				console.error("Unhandled error in payment submission:", err);
				setErrors({ payment: err.message || "An unexpected error occurred. Please try again." });
			} finally {
				setIsProcessing(false);
			}
		},
		[
			sameAsBilling,
			hasShippingAddress,
			billingData,
			user?.addresses,
			shippingAddress,
			checkout.id,
			checkout.totalPrice?.gross?.amount,
			checkout.totalPrice?.gross?.currency,
			checkout.email,
			user?.email,
			paymentMethod,
			hasDummyGateway,
			hasRealGateway,
			updateBillingAddress,
			transactionInitialize,
			checkoutComplete,
			onComplete,
			searchParams,
			router,
		],
	);

	const isCardValid = isCardDataValid(cardData);

	const isPaymentProcessing = transactionState.fetching || completeState.fetching;

	const isLoading = isProcessing || isPaymentProcessing;
	const buttonText = isLoading
		? completeState.fetching
			? "Creating order..."
			: "Processing payment..."
		: `Pay ${totalStr}`;

	const isDisabled =
		isLoading ||
		(paymentMethod !== "razorpay" && !hasDummyGateway && !hasRealGateway) ||
		(paymentMethod === "card" && !hasDummyGateway && !isCardValid);

	return (
		<form className="space-y-8" onSubmit={handleSubmit}>
			{/* Summary Context */}
			<CheckoutSummaryContext checkout={checkout} rows={summaryRows} onGoToStep={handleGoToStep} />

			{/* No Payment Gateway Warning */}
			{paymentMethod !== "razorpay" && !hasDummyGateway && !hasRealGateway && (
				<div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
					<AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
					<div>
						<p className="font-medium text-amber-800">No payment gateway configured</p>
						<p className="mt-1 text-sm text-amber-700">
							To accept payments, install a payment app (like Saleor Dummy Payment for testing, or
							Stripe/Adyen for production) from the Saleor Dashboard.
						</p>
					</div>
				</div>
			)}

			{/* Test Mode Indicator */}
			{paymentMethod !== "razorpay" && hasDummyGateway && !hasRealGateway && (
				<div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
					<AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
					<div>
						<p className="font-medium text-blue-800">Test Mode</p>
						<p className="mt-1 text-sm text-blue-700">
							Using test payment gateway. No real charges will be made.
						</p>
					</div>
				</div>
			)}

			{/* Payment Method */}
			<PaymentMethodSelector
				value={paymentMethod}
				onChange={setPaymentMethod}
				cardData={cardData}
				onCardDataChange={setCardData}
			/>

			{/* Billing Address */}
			<BillingAddressSection
				billingAddress={checkout.billingAddress}
				shippingAddress={shippingAddress}
				userAddresses={authenticated ? (user?.addresses as AddressFragment[]) : undefined}
				defaultBillingAddressId={user?.defaultBillingAddress?.id}
				isShippingRequired={isShippingRequired}
				errors={errors}
				onChange={handleBillingDataChange}
				onSameAsShippingChange={setSameAsBilling}
				initialSameAsShipping={sameAsBilling}
			/>

			{/* Payment/Checkout Error Display */}
			{errors.payment && (
				<div className="border-destructive/50 bg-destructive/10 flex items-start gap-3 rounded-lg border p-4">
					<AlertCircle className="h-5 w-5 flex-shrink-0 text-destructive" />
					<div>
						<p className="font-medium text-destructive">Payment failed</p>
						<p className="text-destructive/80 text-sm">{errors.payment}</p>
					</div>
				</div>
			)}

			{/* Navigation */}
			<div className="flex items-center justify-between">
				<button
					type="button"
					onClick={onBack}
					className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
				>
					<ChevronLeft className="h-4 w-4" />
					{isShippingRequired ? "Return to shipping" : "Return to information"}
				</button>
				<Button type="submit" disabled={isDisabled} className="hidden h-12 min-w-[200px] px-8 md:flex">
					{isLoading ? (
						<span className="flex items-center gap-2">
							<LoadingSpinner />
							{buttonText}
						</span>
					) : (
						buttonText
					)}
				</Button>
			</div>

			<MobileStickyAction
				step={getStepNumber("PAYMENT", isShippingRequired)}
				isShippingRequired={isShippingRequired}
				type="submit"
				onAction={handleSubmit}
				isLoading={isLoading}
				disabled={isDisabled}
				total={totalStr}
				loadingText={completeState.fetching ? "Creating order..." : "Processing payment..."}
			/>
		</form>
	);
};
