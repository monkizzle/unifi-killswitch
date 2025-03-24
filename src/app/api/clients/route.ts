import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/clients - Get all client data
export async function GET() {
  try {
    const clients = await prisma.client.findMany();
    const clientData = clients.reduce((acc, client) => {
      acc[client.mac] = {
        tags: JSON.parse(client.tags),
        hidden: client.hidden,
        blocked: client.blocked,
        lastBlockedAt: client.lastBlockedAt,
        name: client.name
      };
      return acc;
    }, {} as Record<string, any>);

    return NextResponse.json(clientData);
  } catch (error) {
    console.error('Error fetching client data:', error);
    return NextResponse.json({ error: 'Failed to fetch client data' }, { status: 500 });
  }
}

// POST /api/clients - Save client data
export async function POST(request: Request) {
  try {
    const { mac, data } = await request.json();
    
    const existingClient = await prisma.client.findUnique({
      where: { mac }
    });

    if (existingClient) {
      const updated = await prisma.client.update({
        where: { mac },
        data: {
          ...data,
          tags: data.tags ? JSON.stringify(data.tags) : undefined
        }
      });
      return NextResponse.json(updated);
    } else {
      const created = await prisma.client.create({
        data: {
          mac,
          ...data,
          tags: data.tags ? JSON.stringify(data.tags) : '[]'
        }
      });
      return NextResponse.json(created);
    }
  } catch (error) {
    console.error('Error saving client data:', error);
    return NextResponse.json({ error: 'Failed to save client data' }, { status: 500 });
  }
} 