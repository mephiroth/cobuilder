import { NextRequest } from 'next/server';
import { verifyAdmin, adminResponse } from '@/lib/auth';
import { listDocVersions, getLatestDoc, parseDocContent } from '@/lib/db/pipeline-db';
import type { DocumentType } from '@/lib/db/types';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyAdmin(request)) return adminResponse('Unauthorized');

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const type = (searchParams.get('type') || 'prd') as DocumentType;
  const all = searchParams.get('all') === '1';

  if (all) {
    const versions = listDocVersions(id, type);
    return Response.json(
      versions.map((v) => ({
        ...v,
        parsed: parseDocContent(v),
      }))
    );
  }

  const latest = getLatestDoc(id, type);
  if (!latest) return Response.json(null);
  return Response.json({ ...latest, parsed: parseDocContent(latest) });
}
