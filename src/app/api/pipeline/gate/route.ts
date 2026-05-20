import { NextRequest } from 'next/server';
import { verifyAdmin, adminResponse } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return adminResponse('Unauthorized');
  }

  try {
    const {
      getIdea,
      getLatestRequirementDoc,
      reviewRequirementDoc,
      createRequirementDoc,
      updateIdea,
    } = await import('@/lib/db');

    const body = await request.json();
    const { idea_id, decision, doc_id, comments, edited_content } = body;

    if (!idea_id || !decision) {
      return Response.json(
        { error: 'idea_id and decision are required' },
        { status: 400 }
      );
    }

    if (!['approved', 'rejected', 'edited'].includes(decision)) {
      return Response.json(
        { error: 'decision must be one of: approved, rejected, edited' },
        { status: 400 }
      );
    }

    const idea = getIdea(idea_id);
    if (!idea) {
      return Response.json({ error: 'Idea not found' }, { status: 404 });
    }

    // Find the document to review
    let doc;
    if (doc_id) {
      // Use specific doc_id
      const { getRequirementDocs } = await import('@/lib/db');
      const docs = getRequirementDocs(idea_id);
      doc = docs.find(d => d.id === doc_id);
    } else {
      doc = getLatestRequirementDoc(idea_id);
    }

    if (!doc) {
      return Response.json(
        { error: 'No requirement document found for this idea' },
        { status: 404 }
      );
    }

    if (decision === 'approved') {
      // Mark document as reviewed and approved
      reviewRequirementDoc(doc.id, 'approved', comments || 'Approved by admin');
      updateIdea(idea_id, { status: 'clarified' });

      return Response.json({
        message: 'Document approved',
        idea_id,
        doc_id: doc.id,
        new_status: 'clarified',
      });
    }

    if (decision === 'rejected') {
      // Mark document as reviewed and rejected
      reviewRequirementDoc(doc.id, 'rejected', comments || 'Rejected by admin');
      updateIdea(idea_id, { status: 'pending' });

      return Response.json({
        message: 'Document rejected',
        idea_id,
        doc_id: doc.id,
        new_status: 'pending',
      });
    }

    if (decision === 'edited') {
      if (!edited_content) {
        return Response.json(
          { error: 'edited_content is required when decision is "edited"' },
          { status: 400 }
        );
      }

      // Mark original doc as reviewed with edit decision
      reviewRequirementDoc(doc.id, 'edited', comments || 'Edited by admin');

      // Create a new version with the edited content
      const newDoc = createRequirementDoc(
        idea_id,
        edited_content,
        'admin_edited'
      );

      // Mark the new doc as reviewed/approved since it's admin-edited
      reviewRequirementDoc(newDoc.id, 'approved', 'Admin edited and approved');

      // Update idea status
      updateIdea(idea_id, { status: 'clarified' });

      return Response.json({
        message: 'Document edited and new version created',
        idea_id,
        original_doc_id: doc.id,
        new_doc_id: newDoc.id,
        new_version: newDoc.version,
        new_status: 'clarified',
      });
    }

    return Response.json({ error: 'Invalid decision' }, { status: 400 });
  } catch (error) {
    console.error('POST /api/pipeline/gate error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
