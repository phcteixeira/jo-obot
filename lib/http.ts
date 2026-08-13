import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function errorResponse(status: number, detail: unknown) {
  return NextResponse.json({ detail }, { status });
}

export function notFound(detail: string) {
  return errorResponse(404, detail);
}

export function badRequest(err: ZodError) {
  return errorResponse(422, err.flatten());
}
