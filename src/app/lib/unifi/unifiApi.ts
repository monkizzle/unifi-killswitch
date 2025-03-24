import axios, { AxiosInstance } from 'axios';
import https from 'https';

export interface UnifiConfig {
  controllerUrl: string;
  apiKey?: string;
  username?: string;
  password?: string;
  site?: string;
}

export interface UnifiClient {
  _id: string;
  mac: string;
  hostname: string;
  ip: string;
  is_wired: boolean;
  is_guest: boolean;
  blocked: boolean;
  name?: string;
  device_name?: string;
  last_seen: number;
  tags?: string[];
}

export class UnifiApi {
  private controllerUrl: string;
  private apiKey?: string;
  private site: string;
  private axios: AxiosInstance;
  private isLoggedIn: boolean = false;
  private lastLoginTime: number = 0;
  private loginAttempts: number = 0;
  private readonly MAX_LOGIN_ATTEMPTS = 3;
  private readonly BASE_RETRY_DELAY = 5000; // 5 seconds
  private readonly SESSION_TIMEOUT = 3600000; // 1 hour in milliseconds

  constructor(controllerUrl: string, apiKey?: string, site: string = 'default') {
    this.controllerUrl = controllerUrl;
    this.apiKey = apiKey;
    this.site = site;
    
    // Initialize axios instance with default headers
    this.axios = axios.create({
      baseURL: controllerUrl,
      withCredentials: true,
      httpsAgent: new https.Agent({
        rejectUnauthorized: false // Required for self-signed certificates
      }),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-API-KEY': this.apiKey
      }
    });

    if (this.apiKey) {
      console.log('Using API key authentication');
      console.log('UniFi Controller URL:', this.axios.defaults.baseURL);
      this.isLoggedIn = true;
    } else {
      throw new Error('API key must be provided');
    }
  }

  private async ensureLoggedIn(): Promise<void> {
    if (!this.isLoggedIn || Date.now() - this.lastLoginTime > this.SESSION_TIMEOUT) {
      await this.login();
    }
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async login(): Promise<void> {
    try {
      // For API key, we just need to verify the session
      if (this.apiKey) {
        try {
          console.log('Verifying API key with controller...');
          // Try to get sites list as a verification endpoint
          const response = await this.axios.get('/proxy/network/integration/v1/sites', {
            headers: {
              'X-API-KEY': this.apiKey
            }
          });
          console.log('API key verification response:', {
            status: response.status,
            statusText: response.statusText
          });
          this.isLoggedIn = true;
          this.lastLoginTime = Date.now();
        } catch (error: any) {
          console.error('Failed to verify API key session:', {
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data
          });
          throw new Error('Invalid API key or session expired');
        }
      } else {
        throw new Error('API key must be provided');
      }
    } catch (error: any) {
      console.error('Login error:', error.message);
      throw error;
    }
  }

  async getClients(): Promise<UnifiClient[]> {
    try {
      await this.ensureLoggedIn();

      console.log('Fetching clients...');
      
      // Calculate timestamp for 30 days ago (in seconds)
      const thirtyDaysAgo = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
      console.log(`Filtering clients last seen after: ${new Date(thirtyDaysAgo * 1000).toISOString()}`);
      
      // First try to get all clients including historical and blocked ones
      const allStaEndpoint = '/proxy/network/api/s/default/stat/all_sta';
      console.log(`First attempting to fetch ALL clients from: ${allStaEndpoint}`);
      
      try {
        const allStaResponse = await this.axios.get(allStaEndpoint, {
          headers: {
            'X-API-KEY': this.apiKey
          }
        });

        console.log('all_sta response:', {
          status: allStaResponse.status,
          hasData: !!allStaResponse.data,
          dataType: typeof allStaResponse.data,
          keys: allStaResponse.data ? Object.keys(allStaResponse.data) : [],
          dataLength: allStaResponse.data?.data?.length || 0
        });

        // If we successfully get data from all_sta, use it as our base
        if (allStaResponse.data?.data && Array.isArray(allStaResponse.data.data)) {
          const allStaClients = allStaResponse.data.data
            .filter((client: any) => {
              // Convert last_seen to seconds if it's in milliseconds
              const lastSeen = client.last_seen > 1700000000000 ? 
                Math.floor(client.last_seen / 1000) : client.last_seen;
              return lastSeen > thirtyDaysAgo || client.blocked;
            });

          console.log(`Successfully fetched ${allStaClients.length} active/blocked clients from all_sta`);
          
          // Log blocked clients from all_sta
          const blockedClients = allStaClients.filter((c: UnifiClient) => c.blocked);
          console.log(`Found ${blockedClients.length} blocked clients in all_sta:`, 
            blockedClients.map((c: UnifiClient) => ({
              mac: c.mac,
              name: c.name || c.hostname,
              blocked: c.blocked,
              lastSeen: new Date(c.last_seen * 1000).toISOString()
            }))
          );

          // Process and return the clients from all_sta
          return allStaClients.map((client: any) => ({
            _id: client._id || client.id || client.mac,
            mac: client.mac,
            hostname: client.hostname || client.name || 'Unknown',
            ip: client.fixed_ip || client.ip,
            is_wired: client.is_wired || false,
            is_guest: client.is_guest || false,
            blocked: Boolean(client.blocked),
            name: client.name || client.hostname,
            device_name: client.device_name || client.oui || client.hostname,
            last_seen: client.last_seen || Date.now(),
            tags: client.tags || []
          }));
        }
      } catch (allStaError: any) {
        console.error('Failed to fetch from all_sta:', {
          status: allStaError.response?.status,
          message: allStaError.message,
          data: allStaError.response?.data
        });
      }

      // If all_sta fails or returns no data, fall back to other endpoints
      console.log('Falling back to other endpoints...');
      
      const fallbackEndpoints = [
        '/proxy/network/api/s/default/stat/sta',      // Currently connected clients
        '/proxy/network/api/s/default/list/user',     // All known clients
        '/proxy/network/api/s/default/stat/alluser'   // Another endpoint for all users
      ];
      
      let allClients: any[] = [];

      for (const endpoint of fallbackEndpoints) {
        try {
          console.log(`Trying fallback endpoint: ${endpoint}`);
          const response = await this.axios.get(endpoint, {
            headers: {
              'X-API-KEY': this.apiKey
            }
          });

          // Handle different response structures
          let clients: any[] = [];
          if (response.data?.data && Array.isArray(response.data.data)) {
            clients = response.data.data;
          } else if (Array.isArray(response.data)) {
            clients = response.data;
          }

          console.log(`Found ${clients.length} clients in ${endpoint}`);
          const blockedClients = clients.filter(c => c.blocked);
          if (blockedClients.length > 0) {
            console.log(`Found ${blockedClients.length} blocked clients in ${endpoint}:`, 
              blockedClients.map(c => ({
                mac: c.mac,
                name: c.name || c.hostname,
                blocked: c.blocked
              }))
            );
          }

          allClients = [...allClients, ...clients];
        } catch (e: any) {
          console.log(`Failed to fetch from ${endpoint}:`, {
            status: e.response?.status,
            message: e.message
          });
          continue;
        }
      }

      // Remove duplicates and preserve blocked status
      const clientMap = new Map();
      allClients.forEach(client => {
        const existing = clientMap.get(client.mac);
        if (!existing || client.blocked) {
          clientMap.set(client.mac, {
            ...client,
            blocked: client.blocked || (existing?.blocked ?? false)
          });
        }
      });

      const uniqueClients = Array.from(clientMap.values());
      
      // Log final results from fallback
      const finalBlockedClients = uniqueClients.filter(c => c.blocked);
      console.log('Final client counts from fallback:', {
        total: uniqueClients.length,
        blocked: finalBlockedClients.length
      });

      if (finalBlockedClients.length > 0) {
        console.log('Final blocked clients from fallback:', 
          finalBlockedClients.map(c => ({
            mac: c.mac,
            name: c.name || c.hostname,
            blocked: c.blocked
          }))
        );
      }

      return uniqueClients.map(client => ({
        _id: client._id || client.id || client.mac,
        mac: client.mac,
        hostname: client.hostname || client.name || 'Unknown',
        ip: client.fixed_ip || client.ip,
        is_wired: client.is_wired || false,
        is_guest: client.is_guest || false,
        blocked: Boolean(client.blocked),
        name: client.name || client.hostname,
        device_name: client.device_name || client.oui || client.hostname,
        last_seen: client.last_seen || Date.now(),
        tags: client.tags || []
      }));
    } catch (error: any) {
      console.error('Get clients error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      });
      throw new Error('Failed to fetch clients: ' + error.message);
    }
  }

  async blockClient(mac: string): Promise<void> {
    try {
      await this.ensureLoggedIn();

      console.log(`Attempting to block client with MAC: ${mac}`);

      // Try different endpoint paths in order
      const endpoints = [
        `/proxy/network/integration/v1/sites/${this.site}/clients/${mac.toLowerCase()}/block`,
        `/proxy/network/api/s/${this.site}/cmd/stamgr`,
        `/api/s/${this.site}/cmd/stamgr`
      ];

      let response;
      let error;

      for (const endpoint of endpoints) {
        try {
          console.log(`Trying endpoint: ${endpoint}`);
          
          if (endpoint.includes('/rest/user/')) {
            // Try the REST API endpoint
            response = await this.axios.put(endpoint, {
              blocked: true
            }, {
              headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
              }
            });
          } else {
            // Try the command endpoint
            response = await this.axios.post(endpoint, {
              cmd: 'block-sta',
              mac: mac.toLowerCase()
            }, {
              headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
              }
            });
          }

          if (response.status === 200 || response.status === 204) {
            console.log(`Successfully blocked client using endpoint: ${endpoint}`);
            return;
          }
        } catch (e: any) {
          error = e;
          console.log(`Failed to block using ${endpoint}:`, e.response?.status);
          continue;
        }
      }

      throw error || new Error('Block operation failed');
    } catch (error: any) {
      console.error('Block client error:', error.response?.data || error.message);
      throw new Error('Failed to block client');
    }
  }

  async unblockClient(mac: string): Promise<void> {
    try {
      await this.ensureLoggedIn();

      console.log(`Attempting to unblock client with MAC: ${mac}`);

      // Try different endpoint paths in order
      const endpoints = [
        `/proxy/network/integration/v1/sites/${this.site}/clients/${mac.toLowerCase()}/unblock`,
        `/proxy/network/api/s/${this.site}/cmd/stamgr`,
        `/api/s/${this.site}/cmd/stamgr`
      ];

      let response;
      let error;

      for (const endpoint of endpoints) {
        try {
          console.log(`Trying endpoint: ${endpoint}`);
          
          if (endpoint.includes('/rest/user/')) {
            // Try the REST API endpoint
            response = await this.axios.put(endpoint, {
              blocked: false
            }, {
              headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
              }
            });
          } else {
            // Try the command endpoint
            response = await this.axios.post(endpoint, {
              cmd: 'unblock-sta',
              mac: mac.toLowerCase()
            }, {
              headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
              }
            });
          }

          if (response.status === 200 || response.status === 204) {
            console.log(`Successfully unblocked client using endpoint: ${endpoint}`);
            return;
          }
        } catch (e: any) {
          error = e;
          console.log(`Failed to unblock using ${endpoint}:`, e.response?.status);
          continue;
        }
      }

      throw error || new Error('Unblock operation failed');
    } catch (error: any) {
      console.error('Unblock client error:', error.response?.data || error.message);
      throw new Error('Failed to unblock client');
    }
  }
} 