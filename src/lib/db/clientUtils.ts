import { prisma } from './';

export interface ClientData {
  tags?: string[];
  hidden?: boolean;
  blocked?: boolean;
  lastBlockedAt?: Date | null;
  name?: string | null;
}

// Save client data
export const saveClientData = async (mac: string, data: ClientData) => {
  try {
    const existingClient = await prisma.client.findUnique({
      where: { mac }
    });

    if (existingClient) {
      return await prisma.client.update({
        where: { mac },
        data: {
          ...data,
          tags: data.tags ? JSON.stringify(data.tags) : undefined
        }
      });
    } else {
      return await prisma.client.create({
        data: {
          mac,
          ...data,
          tags: data.tags ? JSON.stringify(data.tags) : '[]'
        }
      });
    }
  } catch (error) {
    console.error('Error saving client data:', error);
    throw error;
  }
};

// Load all client data
export const loadClientData = async () => {
  try {
    const clients = await prisma.client.findMany();
    return clients.reduce((acc, client) => {
      acc[client.mac] = {
        tags: JSON.parse(client.tags),
        hidden: client.hidden,
        blocked: client.blocked,
        lastBlockedAt: client.lastBlockedAt,
        name: client.name
      };
      return acc;
    }, {} as Record<string, ClientData>);
  } catch (error) {
    console.error('Error loading client data:', error);
    throw error;
  }
};

// Save client hidden state
export const saveClientHiddenState = async (mac: string, hidden: boolean) => {
  return saveClientData(mac, { hidden });
};

// Load client hidden states
export const loadClientHiddenStates = async () => {
  try {
    const clients = await prisma.client.findMany({
      select: {
        mac: true,
        hidden: true
      }
    });
    return clients.reduce((acc, client) => {
      acc[client.mac] = client.hidden;
      return acc;
    }, {} as Record<string, boolean>);
  } catch (error) {
    console.error('Error loading client hidden states:', error);
    throw error;
  }
};

// Save client blocked state
export const saveClientBlockedState = async (mac: string, blocked: boolean) => {
  return saveClientData(mac, { 
    blocked,
    lastBlockedAt: blocked ? new Date() : null
  });
};

// Load client blocked states
export const loadClientBlockedStates = async () => {
  try {
    const clients = await prisma.client.findMany({
      select: {
        mac: true,
        blocked: true
      }
    });
    return clients.reduce((acc, client) => {
      acc[client.mac] = client.blocked;
      return acc;
    }, {} as Record<string, boolean>);
  } catch (error) {
    console.error('Error loading client blocked states:', error);
    throw error;
  }
}; 