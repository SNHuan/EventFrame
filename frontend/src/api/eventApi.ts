/**
 * 后端事件API客户端
 */

const API_BASE = 'http://localhost:5000/api';

export interface EventResponse {
  success: boolean;
  event: any;
  listeners_executed: number;
  results: string[];
}

export interface HistoryResponse {
  events: any[];
  total: number;
}

export class EventApiClient {
  /**
   * 发布事件到后端
   */
  static async emitToBackend(eventName: string, data: any): Promise<EventResponse> {
    const response = await fetch(`${API_BASE}/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: eventName,
        data,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to emit event: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * 获取事件历史
   */
  static async getHistory(limit = 50): Promise<HistoryResponse> {
    const response = await fetch(`${API_BASE}/events/history?limit=${limit}`);

    if (!response.ok) {
      throw new Error(`Failed to get history: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * 清空事件历史
   */
  static async clearHistory(): Promise<void> {
    const response = await fetch(`${API_BASE}/events/clear`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error(`Failed to clear history: ${response.statusText}`);
    }
  }

  /**
   * 获取监听器信息
   */
  static async getListeners(): Promise<any> {
    const response = await fetch(`${API_BASE}/listeners`);

    if (!response.ok) {
      throw new Error(`Failed to get listeners: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * 健康检查
   */
  static async healthCheck(): Promise<any> {
    const response = await fetch(`${API_BASE}/health`);

    if (!response.ok) {
      throw new Error(`Health check failed: ${response.statusText}`);
    }

    return response.json();
  }
}