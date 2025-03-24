'use client';

import { useState, useEffect } from 'react';
import { UnifiClient } from '../lib/unifi/unifiApi';

interface TaggedUnifiClient extends UnifiClient {
  tags: string[];
  blocked: boolean;
  hidden?: boolean;
  lastBlockedAt?: number;
}

interface ClientData {
  tags: string[];
  hidden: boolean;
  blocked: boolean;
  lastBlockedAt?: Date | null;
  name?: string | null;
}

export default function UnifiClients() {
  const [clients, setClients] = useState<TaggedUnifiClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [showBlockedOnly, setShowBlockedOnly] = useState(false);
  const [showHiddenOnly, setShowHiddenOnly] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [showTagInput, setShowTagInput] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Get unique tags across all clients
  const allTags = Array.from(new Set(clients.flatMap(client => client.tags || [])));

  useEffect(() => {
    const fetchClients = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch UniFi clients and saved client data in parallel
        const [unifiResponse, clientDataResponse] = await Promise.all([
          fetch('/api/unifi'),
          fetch('/api/clients')
        ]);

        if (!unifiResponse.ok || !clientDataResponse.ok) {
          throw new Error('Failed to fetch data');
        }

        const [unifiData, clientData] = await Promise.all([
          unifiResponse.json(),
          clientDataResponse.json()
        ]);

        // Merge UniFi data with saved client data
        const newClients = unifiData.map((client: UnifiClient) => {
          const savedData = clientData[client.mac] || {};
          return {
            ...client,
            tags: savedData.tags || [],
            blocked: client.blocked || savedData.blocked || false,
            hidden: savedData.hidden || false,
            lastBlockedAt: savedData.lastBlockedAt
          };
        });

        setClients(prevClients => {
          // Create a map of existing clients
          const existingMap = new Map(prevClients.map(c => [c.mac, c]));
          
          // Update or add new clients while preserving blocked status
          newClients.forEach((client: TaggedUnifiClient) => {
            const existing = existingMap.get(client.mac);
            if (existing) {
              client.blocked = client.blocked || existing.blocked;
            }
            existingMap.set(client.mac, client);
          });

          return Array.from(existingMap.values());
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch clients');
        console.error('Error fetching clients:', err);
      } finally {
        setLoading(false);
      }
    };

    // Initial fetch
    fetchClients();

    // Set up polling
    const interval = setInterval(fetchClients, 30000);
    return () => clearInterval(interval);
  }, []);

  const saveClientData = async (mac: string, data: Partial<ClientData>) => {
    const response = await fetch('/api/clients', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ mac, data }),
    });

    if (!response.ok) {
      throw new Error('Failed to save client data');
    }

    return response.json();
  };

  const handleBlockClient = async (mac: string, currentlyBlocked: boolean) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/unifi`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          mac, 
          action: currentlyBlocked ? 'unblock' : 'block' 
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update block state');
      }

      // Update local state
      setClients(prevClients =>
        prevClients.map(client =>
          client.mac === mac
            ? { ...client, blocked: !currentlyBlocked }
            : client
        )
      );

      // Save the updated state to the clients API
      await saveClientData(mac, {
        blocked: !currentlyBlocked,
        lastBlockedAt: !currentlyBlocked ? new Date() : null
      });

    } catch (error) {
      console.error('Error updating block state:', error);
      setError('Failed to update block state');
    } finally {
      setLoading(false);
    }
  };

  const handleBlockByTag = async (tag: string, block: boolean) => {
    try {
      setError(null);
      // Get all clients with the specified tag
      const clientsWithTag = clients.filter(client =>
        client.tags.includes(tag)
      );

      // Update each client's blocked status
      for (const client of clientsWithTag) {
        const endpoint = `/api/unifi?mac=${client.mac}&action=${block ? 'block' : 'unblock'}`;
        await fetch(endpoint);
        // Update Firebase blocked state
        await saveClientData(client.mac, {
          blocked: block,
          lastBlockedAt: block ? new Date() : null
        });
      }

      // Update local state
      setClients(prevClients =>
        prevClients.map(client =>
          client.tags.includes(tag)
            ? { ...client, blocked: block }
            : client
        )
      );
    } catch (err) {
      console.error('Error blocking/unblocking by tag:', err);
      setError(err instanceof Error ? err.message : 'Failed to update clients');
    }
  };

  const addTag = async (mac: string, tag: string) => {
    if (!tag.trim()) return;
    
    try {
      const client = clients.find(c => c.mac === mac);
      if (!client) return;

      const newTags = Array.from(new Set([
        ...(client.tags || []),
        tag.trim()
      ]));
      
      // Save updated client data
      await saveClientData(mac, {
        tags: newTags,
        hidden: client.hidden,
        blocked: client.blocked,
        lastBlockedAt: client.lastBlockedAt ? new Date(client.lastBlockedAt) : null
      });
      
      // Update local state
      setClients(prevClients =>
        prevClients.map(c =>
          c.mac === mac
            ? { ...c, tags: newTags }
            : c
        )
      );
      
      setNewTag('');
      setShowTagInput(null);
    } catch (err) {
      setError('Failed to save tag');
      console.error('Error saving tag:', err);
    }
  };

  const removeTag = async (mac: string, tagToRemove: string) => {
    try {
      const client = clients.find(c => c.mac === mac);
      if (!client) return;

      const newTags = client.tags.filter(tag => tag !== tagToRemove);
      
      // Save updated client data
      await saveClientData(mac, {
        tags: newTags,
        hidden: client.hidden,
        blocked: client.blocked,
        lastBlockedAt: client.lastBlockedAt ? new Date(client.lastBlockedAt) : null
      });
      
      // Update local state
      setClients(prevClients =>
        prevClients.map(c =>
          c.mac === mac
            ? { ...c, tags: newTags }
            : c
        )
      );
    } catch (err) {
      setError('Failed to remove tag');
      console.error('Error removing tag:', err);
    }
  };

  const handleHideClient = async (mac: string) => {
    try {
      const client = clients.find(c => c.mac === mac);
      if (!client) return;

      const newHiddenState = !client.hidden;
      
      // Save updated client data
      await saveClientData(mac, {
        tags: client.tags,
        hidden: newHiddenState,
        blocked: client.blocked,
        lastBlockedAt: client.lastBlockedAt ? new Date(client.lastBlockedAt) : null
      });
      
      // Update local state
      setClients(prevClients =>
        prevClients.map(c =>
          c.mac === mac
            ? { ...c, hidden: newHiddenState }
            : c
        )
      );
    } catch (error) {
      console.error('Error toggling client visibility:', error);
      setError('Failed to toggle client visibility');
    }
  };

  const filteredClients = clients.filter(client => {
    // First apply the search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        ((client.name || '').toLowerCase().includes(query)) ||
        ((client.hostname || '').toLowerCase().includes(query)) ||
        ((client.ip || '').toLowerCase().includes(query)) ||
        ((client.mac || '').toLowerCase().includes(query));
      
      if (!matchesSearch) return false;
    }

    // Calculate 30 days ago in seconds
    const thirtyDaysAgo = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);

    // Then apply other filters
    if (showBlockedOnly) {
      return client.blocked;
    }
    if (showHiddenOnly) return client.hidden;
    if (selectedTag) return client.tags.includes(selectedTag);
    
    // For "All" view, show only recent clients (within 30 days) or blocked clients
    return (!client.hidden && (client.blocked || client.last_seen > thirtyDaysAgo));
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">UniFi Kill Switch</h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4" role="alert">
          <p>{error}</p>
        </div>
      )}

      <div className="space-y-4 mb-4">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, IP, or MAC..."
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
            >
              ×
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              setSelectedTag(null);
              setShowBlockedOnly(false);
              setShowHiddenOnly(false);
            }}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              !selectedTag && !showBlockedOnly && !showHiddenOnly ? 'bg-blue-500 text-white' : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            All ({clients.filter(c => {
              const thirtyDaysAgo = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
              return !c.hidden && (c.blocked || c.last_seen > thirtyDaysAgo);
            }).length})
          </button>
          <button
            onClick={() => {
              setSelectedTag(null);
              setShowBlockedOnly(false);
              setShowHiddenOnly(!showHiddenOnly);
            }}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              showHiddenOnly ? 'bg-blue-500 text-white' : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            Hidden ({clients.filter(c => c.hidden).length})
          </button>
          <button
            onClick={() => {
              setSelectedTag(null);
              setShowHiddenOnly(false);
              setShowBlockedOnly(!showBlockedOnly);
            }}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              showBlockedOnly ? 'bg-blue-500 text-white' : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            Blocked ({clients.filter(c => c.blocked).length})
          </button>
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => {
                setSelectedTag(tag);
                setShowBlockedOnly(false);
                setShowHiddenOnly(false);
              }}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                selectedTag === tag ? 'bg-blue-500 text-white' : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              {tag} ({clients.filter(c => c.tags.includes(tag)).length})
            </button>
          ))}
        </div>

        {selectedTag && (
          <div className="flex gap-2">
            <button
              onClick={() => handleBlockByTag(selectedTag, true)}
              className="px-3 py-1.5 rounded text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-colors"
            >
              Block All {selectedTag} ({clients.filter(c => c.tags.includes(selectedTag) && !c.blocked).length})
            </button>
            <button
              onClick={() => handleBlockByTag(selectedTag, false)}
              className="px-3 py-1.5 rounded text-sm font-medium bg-green-500 text-white hover:bg-green-600 transition-colors"
            >
              Unblock All {selectedTag} ({clients.filter(c => c.tags.includes(selectedTag) && c.blocked).length})
            </button>
          </div>
        )}
      </div>

      {loading && !clients.length ? (
        <div className="flex justify-center items-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClients.map((client) => (
            <div
              key={client.mac}
              className={`p-4 rounded-lg border ${
                client.blocked ? 'bg-red-50 border-red-200' : 
                client.hidden ? 'bg-gray-50 border-gray-200' : 
                'bg-white border-gray-200'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-medium">{client.name || client.hostname || 'Unknown Device'}</h3>
                  <p className="text-sm text-gray-500">{client.mac}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleHideClient(client.mac)}
                    className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                      client.hidden 
                        ? 'bg-gray-500 text-white hover:bg-gray-600' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {client.hidden ? 'Show' : 'Hide'}
                  </button>
                  <button
                    onClick={() => handleBlockClient(client.mac, client.blocked)}
                    className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                      client.blocked 
                        ? 'bg-green-500 text-white hover:bg-green-600' 
                        : 'bg-red-500 text-white hover:bg-red-600'
                    }`}
                  >
                    {client.blocked ? 'Unblock' : 'Block'}
                  </button>
                </div>
              </div>
              <div className="text-xs text-gray-500 space-y-0.5">
                <p className="font-mono">{client.ip}</p>
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs bg-gray-100">
                    {client.is_wired ? 'Wired' : 'Wireless'}
                  </span>
                  {client.is_guest && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-800">
                      Guest
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  Last seen: {new Date(client.last_seen * 1000).toLocaleString()}
                </p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {client.tags.map(tag => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-800"
                    >
                      {tag}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeTag(client.mac, tag);
                        }}
                        className="hover:text-blue-600"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  {showTagInput === client.mac ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        addTag(client.mac, newTag);
                      }}
                      className="inline-flex items-center"
                    >
                      <input
                        type="text"
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        className="w-20 px-1 py-0.5 text-xs border rounded"
                        placeholder="Add tag"
                        autoFocus
                      />
                    </form>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowTagInput(client.mac);
                      }}
                      className="text-blue-500 hover:text-blue-600 text-xs"
                    >
                      + Tag
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 