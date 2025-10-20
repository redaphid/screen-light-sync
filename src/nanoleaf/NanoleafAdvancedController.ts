import axios, { AxiosInstance } from 'axios';
import { RGBColor } from '../color/ColorExtractor';

export interface PanelPosition {
  panelId: number;
  x: number;       // Physical X position
  y: number;       // Physical Y position
  o: number;       // Orientation
  shapeType: number;
}

export interface PanelLayout {
  numPanels: number;
  sideLength: number;
  positions: PanelPosition[];
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    width: number;
    height: number;
  };
}

export interface PanelScreenMapping {
  panelId: number;
  screenZone: {
    x: number;      // Screen X (0-1, percentage)
    y: number;      // Screen Y (0-1, percentage)
    width: number;  // Zone width
    height: number; // Zone height
  };
}

/**
 * Advanced Nanoleaf controller with panel-based screen mapping
 * Each panel represents a specific region of the screen
 */
export class NanoleafAdvancedController {
  private ip: string;
  private authToken: string;
  private client: AxiosInstance;
  private readonly port = 16021;
  private panelLayout?: PanelLayout;
  private screenMappings: PanelScreenMapping[] = [];

  constructor(ip: string, authToken: string) {
    this.ip = ip;
    this.authToken = authToken;

    this.client = axios.create({
      baseURL: `http://${this.ip}:${this.port}/api/v1/${this.authToken}`,
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Get the physical layout of Nanoleaf panels
   */
  async getPanelLayout(): Promise<PanelLayout> {
    try {
      const response = await this.client.get('/panelLayout/layout');
      const layout = response.data;

      const positions: PanelPosition[] = layout.positionData.map((panel: any) => ({
        panelId: panel.panelId,
        x: panel.x,
        y: panel.y,
        o: panel.o,
        shapeType: panel.shapeType,
      }));

      // Calculate bounds
      const xs = positions.map(p => p.x);
      const ys = positions.map(p => p.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);

      this.panelLayout = {
        numPanels: layout.numPanels,
        sideLength: layout.sideLength,
        positions,
        bounds: {
          minX,
          maxX,
          minY,
          maxY,
          width: maxX - minX,
          height: maxY - minY,
        },
      };

      console.log(`✓ Detected ${this.panelLayout.numPanels} Nanoleaf panels`);
      console.log(`  Layout size: ${this.panelLayout.bounds.width} x ${this.panelLayout.bounds.height}`);

      return this.panelLayout;
    } catch (error: any) {
      console.error('Error getting panel layout:', error.message);
      throw new Error('Failed to get panel layout');
    }
  }

  /**
   * Map Nanoleaf panels to screen regions
   * Each panel will correspond to a specific area of the screen
   */
  createScreenMapping(): PanelScreenMapping[] {
    if (!this.panelLayout) {
      throw new Error('Panel layout not loaded. Call getPanelLayout() first.');
    }

    const mappings: PanelScreenMapping[] = [];
    const { bounds, positions } = this.panelLayout;

    // Map each panel's physical position to a screen region
    for (const panel of positions) {
      // Normalize panel position to 0-1 range
      const normalizedX = (panel.x - bounds.minX) / bounds.width;
      const normalizedY = (panel.y - bounds.minY) / bounds.height;

      // Each panel represents a small region of the screen
      // We'll sample a region centered on the panel's relative position
      const sampleWidth = 0.15;  // Sample 15% of screen width per panel
      const sampleHeight = 0.15; // Sample 15% of screen height per panel

      mappings.push({
        panelId: panel.panelId,
        screenZone: {
          x: Math.max(0, Math.min(1 - sampleWidth, normalizedX - sampleWidth / 2)),
          y: Math.max(0, Math.min(1 - sampleHeight, normalizedY - sampleHeight / 2)),
          width: sampleWidth,
          height: sampleHeight,
        },
      });
    }

    this.screenMappings = mappings;
    console.log(`✓ Created screen mappings for ${mappings.length} panels`);

    return mappings;
  }

  /**
   * Get the screen mappings
   */
  getScreenMappings(): PanelScreenMapping[] {
    return this.screenMappings;
  }

  /**
   * Set individual panel colors via the effects API
   * This uses the external streaming API for per-panel control
   */
  async setPanelColors(panelColors: Map<number, RGBColor>): Promise<void> {
    try {
      // Build the animation data string
      // Format: "numPanels panelId1 R G B W T panelId2 R G B W T ..."
      // Where: R,G,B = 0-255, W = white (0), T = transition time (1 = instant)

      const animData: string[] = [];
      animData.push(panelColors.size.toString()); // Number of panels

      for (const [panelId, color] of panelColors) {
        animData.push(
          panelId.toString(),
          '1',  // Number of frames (1 = static color)
          color.r.toString(),
          color.g.toString(),
          color.b.toString(),
          '0',  // White channel
          '1'   // Transition time (1 = 100ms, fastest)
        );
      }

      const payload = {
        write: {
          command: 'display',
          animType: 'static',
          animData: animData.join(' '),
          loop: false,
          palette: [],
        },
      };

      await this.client.put('/effects', payload);
    } catch (error: any) {
      console.error('Error setting panel colors:', error.message);
      // Don't throw - continue with other updates
    }
  }

  /**
   * Turn on the Nanoleaf
   */
  async turnOn(): Promise<void> {
    try {
      await this.client.put('/state', { on: { value: true } });
    } catch (error: any) {
      console.error('Error turning on:', error.message);
    }
  }

  /**
   * Turn off the Nanoleaf
   */
  async turnOff(): Promise<void> {
    try {
      await this.client.put('/state', { on: { value: false } });
      console.log('✓ Nanoleaf turned off');
    } catch (error: any) {
      console.error('Error turning off:', error.message);
    }
  }

  /**
   * Set brightness (0-100)
   */
  async setBrightness(brightness: number): Promise<void> {
    try {
      await this.client.put('/state', {
        brightness: { value: Math.min(100, Math.max(0, brightness)) },
      });
    } catch (error: any) {
      console.error('Error setting brightness:', error.message);
    }
  }

  /**
   * Get device info
   */
  async getInfo(): Promise<any> {
    try {
      const response = await this.client.get('/');
      return response.data;
    } catch (error: any) {
      console.error('Error getting info:', error.message);
      throw error;
    }
  }
}
