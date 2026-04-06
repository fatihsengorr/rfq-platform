import { NextRequest, NextResponse } from "next/server";
import { searchCompanies } from "../../api";

export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get("q") ?? undefined;
    const companies = await searchCompanies(q);
    return NextResponse.json(companies);
  } catch (error: any) {
    return NextResponse.json([], { status: 200 });
  }
}
