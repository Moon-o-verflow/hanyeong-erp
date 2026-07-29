import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";

import { AppError, type ErrorCode } from "@/src/lib/errors";

export function dataResponse<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}

export function listResponse<T>(
  data: T[],
  page: { number: number; size: number; totalElements: number },
) {
  return NextResponse.json({
    data,
    page: {
      ...page,
      totalPages: Math.ceil(page.totalElements / page.size),
    },
  });
}

export function errorResponse(
  code: ErrorCode,
  details?: Record<string, unknown>,
  message?: string,
) {
  const error = new AppError(code, details, message);

  return NextResponse.json(
    {
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
    },
    { status: error.status },
  );
}

export async function parseJson<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    throw new AppError("VALIDATION_ERROR");
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", {
      fields: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  return parsed.data;
}

export function zodErrorResponse(error: ZodError) {
  return errorResponse("VALIDATION_ERROR", {
    fields: error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  });
}

export async function handleRoute(
  handler: () => Promise<NextResponse>,
): Promise<NextResponse> {
  try {
    return await handler();
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error.code, error.details, error.message);
    }

    if (error instanceof ZodError) {
      return zodErrorResponse(error);
    }

    return errorResponse("VALIDATION_ERROR");
  }
}
