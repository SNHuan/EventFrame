/**
 * WebSocket 桥接器 - 连接前后端事件总线
 *
 * 功能:
 * 1. 前端事件自动同步到后端
 * 2. 后端事件实时推送到前端
 * 3. 双向事件流
 */

import { io, Socket } from 'socket.io-client';
import { EventBus, type IEvent } from './EventBus';

export interface BridgeOptions {
  url?: string;
  autoConnect?: boolean;
  syncLocalEvents?: boolean; // 是否将本地事件同步到后端
  syncRemoteEvents?: boolean; // 是否将后端事件同步到本地
  allowedEvents?: string[]; // 允许同步的事件列表（支持通配符）
  blockedEvents?: string[]; // 禁止同步的事件列表
}

export class WebSocketBridge {
  private socket: Socket | null = null;
  private eventBus: EventBus;
  private options: Required<BridgeOptions>;
  private connectionStatus: 'disconnected' | 'connecting' | 'connected' = 'disconnected';
  private statusCallbacks: Array<(status: string) => void> = [];

  constructor(eventBus: EventBus, options: BridgeOptions = {}) {
    this.eventBus = eventBus;
    this.options = {
      url: options.url || 'http://localhost:5000',
      autoConnect: options.autoConnect !== false,
      syncLocalEvents: options.syncLocalEvents !== false,
      syncRemoteEvents: options.syncRemoteEvents !== false,
      allowedEvents: options.allowedEvents || ['user.*', 'order.*', 'notification.*', 'public.*'],
      blockedEvents: options.blockedEvents || ['private.*', 'system.*', 'admin.*', 'auth.*'],
    };

    if (this.options.autoConnect) {
      this.connect();
    }
  }

  /**
   * 检查事件是否允许同步
   */
  private isEventAllowed(eventName: string): boolean {
    // 检查黑名单
    for (const blocked of this.options.blockedEvents!) {
      if (blocked.endsWith('*')) {
        const prefix = blocked.slice(0, -1);
        if (eventName.startsWith(prefix)) {
          return false;
        }
      } else if (eventName === blocked) {
        return false;
      }
    }

    // 检查白名单
    for (const allowed of this.options.allowedEvents!) {
      if (allowed.endsWith('*')) {
        const prefix = allowed.slice(0, -1);
        if (eventName.startsWith(prefix)) {
          return true;
        }
      } else if (eventName === allowed) {
        return true;
      }
    }

    return false;
  }

  /**
   * 连接到后端
   */
  connect(): void {
    if (this.socket?.connected) {
      console.log('Already connected');
      return;
    }

    this.connectionStatus = 'connecting';
    this.notifyStatusChange('connecting');

    this.socket = io(this.options.url, {
      transports: ['websocket', 'polling'],
    });

    this.setupEventHandlers();
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connectionStatus = 'disconnected';
      this.notifyStatusChange('disconnected');
    }
  }

  /**
   * 监听连接状态变化
   */
  onStatusChange(callback: (status: string) => void): () => void {
    this.statusCallbacks.push(callback);
    // 返回取消订阅函数
    return () => {
      const index = this.statusCallbacks.indexOf(callback);
      if (index > -1) {
        this.statusCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * 获取连接状态
   */
  getStatus(): string {
    return this.connectionStatus;
  }

  /**
   * 向后端发送事件
   */
  emitToBackend(eventName: string, data: any): void {
    if (!this.socket?.connected) {
      console.warn('WebSocket not connected, cannot emit event');
      return;
    }

    this.socket.emit('emit_event', {
      name: eventName,
      data,
    });
  }

  private setupEventHandlers(): void {
    if (!this.socket) return;

    // 连接成功
    this.socket.on('connect', () => {
      console.log('✓ WebSocket 已连接');
      this.connectionStatus = 'connected';
      this.notifyStatusChange('connected');
    });

    // 连接断开
    this.socket.on('disconnect', () => {
      console.log('✗ WebSocket 已断开');
      this.connectionStatus = 'disconnected';
      this.notifyStatusChange('disconnected');
    });

    // 连接状态
    this.socket.on('connection_status', (data) => {
      console.log('📡 连接状态:', data.message);
    });

    // 接收后端广播的事件
    this.socket.on('event', (eventData) => {
      if (this.options.syncRemoteEvents) {
        console.log('📨 收到后端事件:', eventData);

        // 将后端事件发布到本地事件总线
        const event: IEvent = {
          name: eventData.name,
          data: eventData.data,
          timestamp: new Date(eventData.timestamp),
          metadata: {
            ...eventData.metadata,
            source: 'backend',
          },
        };

        // 发布到本地，但不触发反向同步
        this.eventBus.emit(event);
      }
    });

    // 事件发送结果
    this.socket.on('event_result', (result) => {
      console.log('✓ 后端事件处理结果:', result);
    });

    // 错误处理
    this.socket.on('event_error', (error) => {
      console.error('❌ 后端事件错误:', error);
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ WebSocket 连接错误:', error.message);
      this.connectionStatus = 'disconnected';
      this.notifyStatusChange('disconnected');
    });

    // 如果启用本地事件同步，监听本地事件总线
    if (this.options.syncLocalEvents) {
      this.setupLocalEventSync();
    }
  }

  /**
   * 设置本地事件同步到后端
   */
  private setupLocalEventSync(): void {
    // 监听所有本地事件
    this.eventBus.on('*', (event) => {
      // 避免循环：不同步来自后端的事件
      if (event.metadata?.source === 'backend') {
        return;
      }

      // 安全检查：只同步允许的事件
      if (!this.isEventAllowed(event.name)) {
        console.log('🔒 事件不允许同步到后端:', event.name);
        return;
      }

      // 同步到后端
      if (this.socket?.connected) {
        console.log('📤 同步本地事件到后端:', event.name);
        this.emitToBackend(event.name, event.data);
      }
    }, { priority: -100 }); // 低优先级，最后执行
  }

  private notifyStatusChange(status: string): void {
    this.statusCallbacks.forEach(callback => {
      try {
        callback(status);
      } catch (error) {
        console.error('Error in status callback:', error);
      }
    });
  }
}

/**
 * 创建桥接器的工厂函数
 */
export function createBridge(eventBus: EventBus, options?: BridgeOptions): WebSocketBridge {
  return new WebSocketBridge(eventBus, options);
}