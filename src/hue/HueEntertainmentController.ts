import { v3 } from 'node-hue-api';
import { RGBColor } from '../color/ColorExtractor';
import * as dgram from 'dgram';

const hueApi = v3.api;

export interface EntertainmentArea {
  id: number;
  name: string;
  lights: number[];
  locations: Map<number, { x: number; y: number; z: number }>;
}

/**
 * Hue Entertainment API Controller for high-speed light updates
 * Supports up to 60 FPS updates for gaming/video sync
 */
export class HueEntertainmentController {
  private bridgeIp: string;
  private username: string;
  private clientKey?: string;
  private apiInstance?: any;
  private socket?: dgram.Socket;
  private streamActive = false;
  private entertainmentAreaId?: number;

  constructor(bridgeIp: string, username: string, clientKey?: string) {
    this.bridgeIp = bridgeIp;
    this.username = username;
    this.clientKey = clientKey;
  }

  /**
   * Connect and get API instance
   */
  async connect(): Promise<void> {
    try {
      this.apiInstance = await hueApi.createLocal(this.bridgeIp).connect(this.username);
      console.log('✓ Connected to Hue bridge for Entertainment API');
    } catch (error: any) {
      console.error('Error connecting:', error.message);
      throw new Error('Failed to connect to bridge');
    }
  }

  /**
   * Get all entertainment areas configured on the bridge
   */
  async getEntertainmentAreas(): Promise<EntertainmentArea[]> {
    if (!this.apiInstance) {
      throw new Error('Not connected to bridge');
    }

    try {
      const groups = await this.apiInstance.groups.getAll();
      const entertainmentAreas: EntertainmentArea[] = [];

      for (const group of groups) {
        if (group.type === 'Entertainment') {
          const locations = new Map<number, { x: number; y: number; z: number }>();

          // Parse location data if available
          if (group.locations) {
            for (const [lightId, location] of Object.entries(group.locations)) {
              locations.set(parseInt(lightId), location as any);
            }
          }

          entertainmentAreas.push({
            id: group.id,
            name: group.name,
            lights: group.lights || [],
            locations,
          });
        }
      }

      return entertainmentAreas;
    } catch (error: any) {
      console.error('Error getting entertainment areas:', error.message);
      throw new Error('Failed to get entertainment areas');
    }
  }

  /**
   * Activate an entertainment area for streaming
   */
  async activateEntertainmentArea(areaId: number): Promise<void> {
    if (!this.apiInstance) {
      throw new Error('Not connected to bridge');
    }

    try {
      // Activate the entertainment area
      await this.apiInstance.groups.enableStreaming(areaId);
      this.entertainmentAreaId = areaId;
      this.streamActive = true;

      console.log(`✓ Entertainment area ${areaId} activated for streaming`);
    } catch (error: any) {
      console.error('Error activating entertainment area:', error.message);
      throw new Error('Failed to activate entertainment area');
    }
  }

  /**
   * Deactivate entertainment streaming
   */
  async deactivateEntertainmentArea(): Promise<void> {
    if (!this.apiInstance || !this.entertainmentAreaId) {
      return;
    }

    try {
      await this.apiInstance.groups.disableStreaming(this.entertainmentAreaId);
      this.streamActive = false;
      console.log('✓ Entertainment streaming deactivated');
    } catch (error: any) {
      console.error('Error deactivating entertainment area:', error.message);
    }
  }

  /**
   * Send entertainment API update (DTLS UDP streaming)
   * Note: Full DTLS implementation is complex. This is a simplified version.
   * For production, consider using existing libraries or the official SDK.
   */
  async setEntertainmentLights(lightColors: Map<number, RGBColor>): Promise<void> {
    if (!this.streamActive) {
      throw new Error('Entertainment area not active');
    }

    // Entertainment API uses DTLS over UDP on port 2100
    // This is a simplified implementation - full DTLS requires the clientKey
    // For now, we'll fall back to fast regular API calls

    // TODO: Implement full DTLS protocol for true Entertainment API streaming
    // This requires PSK-TLS handshake using the clientKey

    // Fallback: Use regular API with fast updates
    const promises: Promise<any>[] = [];
    for (const [lightId, color] of lightColors) {
      const state = new v3.lightStates.LightState()
        .on(true)
        .rgb(color.r, color.g, color.b)
        .transitionInstant();

      promises.push(
        this.apiInstance.lights.setLightState(lightId, state).catch(() => {
          // Ignore errors in fast mode
        })
      );
    }

    // Don't await all - fire and forget for speed
    Promise.allSettled(promises);
  }

  /**
   * Check if streaming is active
   */
  isStreamingActive(): boolean {
    return this.streamActive;
  }

  /**
   * Get current entertainment area ID
   */
  getCurrentAreaId(): number | undefined {
    return this.entertainmentAreaId;
  }

  /**
   * Cleanup
   */
  async cleanup(): Promise<void> {
    await this.deactivateEntertainmentArea();
    if (this.socket) {
      this.socket.close();
    }
  }
}
