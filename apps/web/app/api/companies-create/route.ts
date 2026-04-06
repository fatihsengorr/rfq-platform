import { NextRequest, NextResponse } from "next/server";
import { createCompany } from "../../api";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const company = await createCompany(body);
    return NextResponse.json(company, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message ?? "Failed to create company" },
      { status: error.status ?? 500 }
    );
  }
}
