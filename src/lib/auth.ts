import { NextRequest } from 'next/server';

import crypto from 'crypto';

const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
if (!ADMIN_TOKEN) {
  console.error('FATAL: ADMIN_TOKEN environment variable is not set');
}

export function verifyAdmin(request: NextRequest): boolean {
  if (!ADMIN_TOKEN) return false;
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return false;
  const token = authHeader.replace('Bearer ', '');
  // Timing-safe comparison to prevent timing attacks
  const a = Buffer.from(token);
  const b = Buffer.from(ADMIN_TOKEN);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function adminResponse(message: string, status = 401) {
  return Response.json({ error: message }, { status });
}
