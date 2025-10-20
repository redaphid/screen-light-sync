// Direct HTTP implementation of Hue Entertainment API
// Bypasses node-hue-api library validation bugs
const axios = require('axios');

class HueEntertainmentDirect {
  constructor(bridgeIp, username) {
    this.bridgeIp = bridgeIp;
    this.username = username;
    this.baseUrl = `http://${bridgeIp}/api/${username}`;
    this.activeAreaId = null;
  }

  // Get all groups (including Entertainment areas)
  async getGroups() {
    try {
      const response = await axios.get(`${this.baseUrl}/groups`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get groups: ${error.message}`);
    }
  }

  // Get Entertainment areas only
  async getEntertainmentAreas() {
    const groups = await this.getGroups();
    const entertainmentAreas = [];

    for (const [id, group] of Object.entries(groups)) {
      if (group.type === 'Entertainment') {
        entertainmentAreas.push({
          id: parseInt(id),
          name: group.name,
          class: group.class,
          lights: group.lights.map(l => parseInt(l)),
          state: group.state,
          stream: group.stream
        });
      }
    }

    return entertainmentAreas;
  }

  // Activate Entertainment mode for an area
  async activateEntertainmentArea(areaId) {
    try {
      // First, deactivate any other active areas
      if (this.activeAreaId && this.activeAreaId !== areaId) {
        await this.deactivateEntertainmentArea(this.activeAreaId);
      }

      // Activate streaming for this area
      const response = await axios.put(
        `${this.baseUrl}/groups/${areaId}`,
        { stream: { active: true } }
      );

      if (response.data[0]?.error) {
        throw new Error(response.data[0].error.description);
      }

      this.activeAreaId = areaId;
      console.log(`✅ Entertainment area ${areaId} activated`);
      return true;
    } catch (error) {
      throw new Error(`Failed to activate Entertainment area: ${error.message}`);
    }
  }

  // Deactivate Entertainment mode
  async deactivateEntertainmentArea(areaId) {
    try {
      await axios.put(
        `${this.baseUrl}/groups/${areaId}`,
        { stream: { active: false } }
      );

      if (this.activeAreaId === areaId) {
        this.activeAreaId = null;
      }
      return true;
    } catch (error) {
      throw new Error(`Failed to deactivate Entertainment area: ${error.message}`);
    }
  }

  // Fast update using group action (much faster than individual lights)
  async updateEntertainmentGroup(areaId, hue, sat, bri) {
    try {
      const response = await axios.put(
        `${this.baseUrl}/groups/${areaId}/action`,
        {
          on: true,
          hue: hue,
          sat: sat,
          bri: bri,
          transitiontime: 0  // Instant
        }
      );

      if (response.data[0]?.error) {
        throw new Error(response.data[0].error.description);
      }

      return true;
    } catch (error) {
      throw new Error(`Failed to update Entertainment group: ${error.message}`);
    }
  }

  // Update individual light in Entertainment area (for zone-based control)
  async updateLight(lightId, hue, sat, bri) {
    try {
      await axios.put(
        `${this.baseUrl}/lights/${lightId}/state`,
        {
          on: true,
          hue: hue,
          sat: sat,
          bri: bri,
          transitiontime: 0
        }
      );
      return true;
    } catch (error) {
      // Silently fail for unreachable lights
      return false;
    }
  }

  // Get current state of Entertainment area
  async getGroupState(areaId) {
    try {
      const response = await axios.get(`${this.baseUrl}/groups/${areaId}`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get group state: ${error.message}`);
    }
  }
}

module.exports = { HueEntertainmentDirect };
