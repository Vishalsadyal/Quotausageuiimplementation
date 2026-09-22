import { NextRequest, NextResponse } from 'next/server';
import { prisma } from 'src/lib/prisma';
import { verifyAuthToken } from '@/app/api/internal/lib/server-auth';

export const dynamic = 'force-dynamic';

// GET - Fetch all email templates for a user
export async function GET(req: NextRequest) {
  try {
    const userId = await verifyAuthToken(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const templates = await prisma.emailTemplate.findMany({
      where: { 
        OR: [
          { userId },
          { isGlobal: true }
        ]
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ templates }, { status: 200 });
  } catch (error) {
    console.error('Error fetching templates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    );
  }
}

// POST - Create a new email template
export async function POST(req: NextRequest) {
  try {
    const userId = await verifyAuthToken(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { name, subject, htmlContent, textContent, category } = body;

    if (!name || !subject || !htmlContent) {
      return NextResponse.json(
        { error: 'Name, subject, and content are required' },
        { status: 400 }
      );
    }

    const template = await prisma.emailTemplate.create({
      data: {
        userId,
        name,
        subject,
        htmlContent,
        textContent: textContent || '',
        category: category || 'general',
        isGlobal: false
      }
    });

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    console.error('Error creating template:', error);
    return NextResponse.json(
      { error: 'Failed to create template' },
      { status: 500 }
    );
  }
}

// PATCH - Update an email template
export async function PATCH(req: NextRequest) {
  try {
    const userId = await verifyAuthToken(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { id, name, subject, body: templateBody, category } = body;

    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        { error: 'Valid template ID is required' },
        { status: 400 }
      );
    }

    // Verify ownership
    const existingTemplate = await prisma.emailTemplate.findUnique({
      where: { id }
    });

    if (!existingTemplate || (existingTemplate.userId !== userId && !existingTemplate.isGlobal)) {
      return NextResponse.json(
        { error: 'Template not found or unauthorized' },
        { status: 404 }
      );
    }

    if (existingTemplate.isGlobal) {
      return NextResponse.json(
        { error: 'Cannot edit global templates' },
        { status: 403 }
      );
    }

    const updateData: {
      name?: string;
      subject?: string;
      body?: string;
      category?: string;
    } = {};

    if (typeof name === 'string') updateData.name = name.trim();
    if (typeof subject === 'string') updateData.subject = subject.trim();
    if (typeof templateBody === 'string') updateData.body = templateBody;
    if (typeof category === 'string') updateData.category = category.trim();

    const template = await prisma.emailTemplate.update({
      where: { id },
      data: updateData
    });

    return NextResponse.json({ template }, { status: 200 });
  } catch (error) {
    console.error('Error updating template:', error);
    return NextResponse.json(
      { error: 'Failed to update template' },
      { status: 500 }
    );
  }
}

// DELETE - Delete an email template
export async function DELETE(req: NextRequest) {
  try {
    const userId = await verifyAuthToken(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Template ID is required' },
        { status: 400 }
      );
    }

    // Verify ownership
    const existingTemplate = await prisma.emailTemplate.findUnique({
      where: { id }
    });

    if (!existingTemplate || existingTemplate.userId !== userId) {
      return NextResponse.json(
        { error: 'Template not found or unauthorized' },
        { status: 404 }
      );
    }

    if (existingTemplate.isGlobal) {
      return NextResponse.json(
        { error: 'Cannot delete global templates' },
        { status: 403 }
      );
    }

    await prisma.emailTemplate.delete({
      where: { id }
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Error deleting template:', error);
    return NextResponse.json(
      { error: 'Failed to delete template' },
      { status: 500 }
    );
  }
}
