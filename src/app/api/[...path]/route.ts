/**
 * Server-side API Proxy Route
 *
 * Intercepts all /api/* requests from the Next.js frontend and forwards them
 * to the Render backend, injecting the Authorization: Bearer header
 * server-side so the secret key is never exposed to the client.
 *
 * Handles: GET, POST, PUT, DELETE + SSE streaming (telemetry/stream)
 */

import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");

const API_SECRET_KEY = process.env.API_SECRET_KEY || "";

async function proxyRequest(
  request: NextRequest,
  params: { path: string[] }
): Promise<NextResponse> {
  const pathSegments = params.path ?? [];
  const targetUrl = `${BACKEND_URL}/api/${pathSegments.join("/")}${request.nextUrl.search}`;

  // Build forwarded headers — inject auth key server-side
  const forwardHeaders = new Headers();
  request.headers.forEach((value, key) => {
    // Skip host header to avoid conflicts with the target origin
    if (key.toLowerCase() !== "host") {
      forwardHeaders.set(key, value);
    }
  });
  if (API_SECRET_KEY) {
    forwardHeaders.set("Authorization", `Bearer ${API_SECRET_KEY}`);
  }

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const body = hasBody ? await request.arrayBuffer() : undefined;

  try {
    const upstream = await fetch(targetUrl, {
      method: request.method,
      headers: forwardHeaders,
      body: hasBody ? body : undefined,
      // @ts-expect-error — Node 18+ fetch supports duplex for streaming
      duplex: "half",
    });

    // Pass streaming responses (SSE) straight through
    const responseHeaders = new Headers();
    upstream.headers.forEach((value, key) => {
      responseHeaders.set(key, value);
    });
    // Allow cross-origin access from the Vercel frontend
    responseHeaders.set("Access-Control-Allow-Origin", "*");

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (err) {
    console.error(`[Proxy] Failed to reach backend at ${targetUrl}:`, err);
    return NextResponse.json(
      { detail: "Upstream service unavailable" },
      { status: 503 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return proxyRequest(request, params);
}

export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return proxyRequest(request, params);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return proxyRequest(request, params);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return proxyRequest(request, params);
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
