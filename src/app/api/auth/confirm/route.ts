import { NextRequest, NextResponse } from "next/server";
import { executeRawGraphQL, asValidationError, getUserMessage } from "@/lib/graphql";

const CONFIRM_ACCOUNT_MUTATION = `
  mutation ConfirmAccount($email: String!, $token: String!) {
    confirmAccount(email: $email, token: $token) {
      user {
        id
        email
      }
      errors {
        field
        message
        code
      }
    }
  }
`;

interface ConfirmAccountRequest {
	email: string;
	token: string;
}

interface ConfirmAccountResult {
	confirmAccount?: {
		user?: { id: string; email: string } | null;
		errors?: Array<{ field?: string | null; message: string; code?: string | null }>;
	};
}

export async function POST(request: NextRequest) {
	const body = (await request.json()) as ConfirmAccountRequest;
	const { email, token } = body;

	if (!email || !token) {
		return NextResponse.json(
			{ errors: [{ message: "Email and token are required", code: "REQUIRED" }] },
			{ status: 400 },
		);
	}

	const result = await executeRawGraphQL<ConfirmAccountResult>({
		query: CONFIRM_ACCOUNT_MUTATION,
		variables: { email, token },
	});

	// Network or GraphQL error
	if (!result.ok) {
		console.error("Account confirmation error:", result.error.type);
		return NextResponse.json(
			{ errors: [{ message: getUserMessage(result.error), code: result.error.type.toUpperCase() }] },
			{ status: result.error.type === "network" ? 503 : 400 },
		);
	}

	const confirmAccount = result.data.confirmAccount;

	// Saleor validation errors
	if (confirmAccount?.errors?.length) {
		const validationResult = asValidationError(confirmAccount.errors);
		return NextResponse.json({ errors: validationResult.error.validationErrors }, { status: 400 });
	}

	return NextResponse.json({
		success: true,
		user: confirmAccount?.user,
	});
}
