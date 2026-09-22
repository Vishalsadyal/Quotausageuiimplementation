import { NextRequest, NextResponse } from 'next/server';
import { prisma } from 'src/lib/prisma';
import { verifyAuthToken } from '@/app/api/internal/lib/server-auth';

export const dynamic = 'force-dynamic';

// GET - Fetch all campaigns for a user
export async function GET(req: NextRequest) {
  try {
    const userId = await verifyAuthToken(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const campaigns = await prisma.marketingCampaign.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { emails: true }
        }
      }
    });

    return NextResponse.json({ campaigns }, { status: 200 });
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    return NextResponse.json(
      { error: 'Failed to fetch campaigns' },
      { status: 500 }
    );
  }
}

// POST - Create a new campaign
export async function POST(req: NextRequest) {
  try {
    const userId = await verifyAuthToken(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { name, subject, templateId, scheduledAt, recipientList, status } = body;

    if (!name || !subject) {
      return NextResponse.json(
        { error: 'Name and subject are required' },
        { status: 400 }
      );
    }

    const campaign = await prisma.marketingCampaign.create({
      data: {
        userId,
        name,
        subject,
        templateId: templateId || null,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        recipientList: recipientList || [],
        status: status || 'draft',
        stats: {
          sent: 0,
          delivered: 0,
          opened: 0,
          clicked: 0,
          bounced: 0,
          unsubscribed: 0
        }
      }
    });

    return NextResponse.json({ campaign }, { status: 201 });
  } catch (error) {
    console.error('Error creating campaign:', error);
    return NextResponse.json(
      { error: 'Failed to create campaign' },
      { status: 500 }
    );
  }
}

// PATCH - Update a campaign
export async function PATCH(req: NextRequest) {
  try {
    const userId = await verifyAuthToken(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { id, name, subject, templateId, scheduledAt, recipientList, status } = body;

    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        { error: 'Valid campaign ID is required' },
        { status: 400 }
      );
    }

    // Verify ownership
    const existingCampaign = await prisma.marketingCampaign.findUnique({
      where: { id }
    });

    if (!existingCampaign || existingCampaign.userId !== userId) {
      return NextResponse.json(
        { error: 'Campaign not found or unauthorized' },
        { status: 404 }
      );
    }

    const updateData: {
      name?: string;
      subject?: string;
      templateId?: string | null;
      scheduledAt?: Date | null;
      recipientList?: any;
      status?: any;
    } = {};

    if (typeof name === 'string') updateData.name = name.trim();
    if (typeof subject === 'string') updateData.subject = subject.trim();
    if (templateId !== undefined) updateData.templateId = templateId || null;
    if (scheduledAt !== undefined) updateData.scheduledAt = scheduledAt ? new Date(scheduledAt) : null;
    if (recipientList !== undefined) updateData.recipientList = recipientList;
    if (status !== undefined) updateData.status = status;

    const campaign = await prisma.marketingCampaign.update({
      where: { id },
      data: updateData
    });

    return NextResponse.json({ campaign }, { status: 200 });
  } catch (error) {
    console.error('Error updating campaign:', error);
    return NextResponse.json(
      { error: 'Failed to update campaign' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a campaign
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
        { error: 'Campaign ID is required' },
        { status: 400 }
      );
    }

    // Verify ownership
    const existingCampaign = await prisma.marketingCampaign.findUnique({
      where: { id }
    });

    if (!existingCampaign || existingCampaign.userId !== userId) {
      return NextResponse.json(
        { error: 'Campaign not found or unauthorized' },
        { status: 404 }
      );
    }

    await prisma.marketingCampaign.delete({
      where: { id }
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Error deleting campaign:', error);
    return NextResponse.json(
      { error: 'Failed to delete campaign' },
      { status: 500 }
    );
  }
}
