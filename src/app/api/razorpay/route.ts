import { NextResponse } from "next/server";
import Razorpay from "razorpay";

export async function POST(request: Request) {
	try {
		const key_id = process.env.RAZORPAY_KEY_ID;
		const key_secret = process.env.RAZORPAY_KEY_SECRET;

		if (!key_id || !key_secret) {
			console.error("Razorpay API keys not configured");
			return NextResponse.json({ error: "Razorpay API keys not configured" }, { status: 500 });
		}

		const razorpay = new Razorpay({ key_id, key_secret });
		const body: any = await request.json();
		const { amount, currency = "INR", receipt } = body;

		if (!amount) {
			return NextResponse.json({ error: "Amount is required" }, { status: 400 });
		}

		const options = {
			amount: Math.round(amount * 100), // Razorpay expects amount in smallest currency unit (e.g., paise)
			currency,
			receipt,
		};

		const order = await razorpay.orders.create(options);
		return NextResponse.json({
			...order,
			key_id: process.env.RAZORPAY_KEY_ID || "rzp_test_SkpDhLqEluUnqj",
		});
	} catch (error: any) {
		console.error("Razorpay error:", error);
		return NextResponse.json({ error: error.message || "Something went wrong" }, { status: 500 });
	}
}
