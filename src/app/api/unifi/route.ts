import { UnifiApi } from '@/app/lib/unifi/unifiApi';
import { NextRequest, NextResponse } from 'next/server';

// Initialize the UniFi API client only if we have the required environment variables
const unifiApi = process.env.UNIFI_CONTROLLER_URL && process.env.UNIFI_API_KEY
  ? new UnifiApi(
      process.env.UNIFI_CONTROLLER_URL.replace(/\/$/, ''), // Remove trailing slash if present
      process.env.UNIFI_API_KEY,
      'default'
    )
  : null;

export async function GET() {
  if (!unifiApi) {
    console.error('UniFi API not configured. Missing environment variables:', {
      hasUrl: !!process.env.UNIFI_CONTROLLER_URL,
      hasKey: !!process.env.UNIFI_API_KEY
    });
    return NextResponse.json({ error: 'UniFi API not configured' }, { status: 503 });
  }

  try {
    console.log('Attempting to fetch UniFi clients...');
    const clients = await unifiApi.getClients();
    return NextResponse.json(clients);
  } catch (error: any) {
    console.error('UniFi API Error:', error.message);
    return NextResponse.json(
      { error: 'Error fetching clients: ' + error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!unifiApi) {
    return NextResponse.json({ error: 'UniFi API not configured' }, { status: 503 });
  }

  try {
    const { action, mac } = await request.json();

    if (!mac) {
      return NextResponse.json({ error: 'MAC address is required' }, { status: 400 });
    }

    if (action === 'block') {
      await unifiApi.blockClient(mac);
      return NextResponse.json({ message: `Client ${mac} blocked successfully` });
    } else if (action === 'unblock') {
      await unifiApi.unblockClient(mac);
      return NextResponse.json({ message: `Client ${mac} unblocked successfully` });
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('UniFi API Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 