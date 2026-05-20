import { NextRequest } from 'next/server';

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'cobuilder-admin-2026';

export function verifyAdmin(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return false;
  const token = authHeader.replace('Bearer ', '');
  return token === ADMIN_TOKEN;
}

export function adminResponse(message: string, status = 401) {
  return Response.json({ error: message }, { status });
}
