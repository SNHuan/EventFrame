/**
 * 事件系统 TypeScript 实现
 *
 * 设计理念:
 * 1. 类型安全的事件系统
 * 2. 支持泛型约束
 * 3. 装饰器模式
 * 4. 响应式集成
 */

// ============= 类型定义 =============

/**
 * 事件接口 - 所有事件的基础结构
 */
export interface IEvent<T = any> {
  name: string;
  data: T;
  timestamp: Date;
  metadata?: Record<string, any>;
}

/**
 * 事件监听器类型
 */
export type EventListener<T = any> = (event: IEvent<T>) => void | Promise<void>;

/**
 * 事件中间件类型
 */
export type EventMiddleware = <T>(event: IEvent<T>) => IEvent<T>;

/**
 * 订阅选项
 */
export interface SubscribeOptions {
  priority?: number;
  once?: boolean;
}

// ============= 事件基类 =============

/**
 * 事件抽象基类
 */
export abstract class Event<T = any> implements IEvent<T> {
  public readonly name: string;
  public readonly data: T;
  public readonly timestamp: Date;
  public metadata: Record<string, any>;

  constructor(name: string, data: T, metadata: Record<string, any> = {}) {
    this.name = name;
    this.data = data;
    this.timestamp = new Date();
    this.metadata = metadata;
  }

  toJSON(): object {
    return {
      name: this.name,
      data: this.data,
      timestamp: this.timestamp.toISOString(),
      metadata: this.metadata,
    };
  }
}

// ============= 事件总线 =============

interface ListenerEntry {
  listener: EventListener;
  priority: number;
  once: boolean;
}

/**
 * 事件总线 - 核心调度器
 */
export class EventBus {
  private listeners: Map<string, ListenerEntry[]> = new Map();
  private wildcardListeners: ListenerEntry[] = [];
  private middleware: EventMiddleware[] = [];
  private eventHistory: IEvent[] = [];
  private maxHistorySize = 100;

  /**
   * 订阅事件
   */
  on<T = any>(
    eventName: string,
    listener: EventListener<T>,
    options: SubscribeOptions = {}
  ): () => void {
    const { priority = 0, once = false } = options;
    const entry: ListenerEntry = { listener, priority, once };

    if (eventName === '*') {
      this.wildcardListeners.push(entry);
      this.wildcardListeners.sort((a, b) => b.priority - a.priority);
    } else {
      if (!this.listeners.has(eventName)) {
        this.listeners.set(eventName, []);
      }
      const listeners = this.listeners.get(eventName)!;
      listeners.push(entry);
      listeners.sort((a, b) => b.priority - a.priority);
    }

    // 返回取消订阅函数
    return () => this.off(eventName, listener);
  }

  /**
   * 订阅一次
   */
  once<T = any>(eventName: string, listener: EventListener<T>, priority = 0): () => void {
    return this.on(eventName, listener, { priority, once: true });
  }

  /**
   * 取消订阅
   */
  off<T = any>(eventName: string, listener: EventListener<T>): void {
    if (eventName === '*') {
      this.wildcardListeners = this.wildcardListeners.filter(
        (entry) => entry.listener !== listener
      );
    } else {
      const listeners = this.listeners.get(eventName);
      if (listeners) {
        this.listeners.set(
          eventName,
          listeners.filter((entry) => entry.listener !== listener)
        );
      }
    }
  }

  /**
   * 发布事件
   */
  async emit<T = any>(event: IEvent<T> | string, data?: T): Promise<void> {
    // 支持直接传递事件名和数据
    const eventObj: IEvent<T> =
      typeof event === 'string'
        ? { name: event, data: data!, timestamp: new Date() }
        : event;

    // 应用中间件
    let processedEvent = eventObj;
    for (const middleware of this.middleware) {
      processedEvent = middleware(processedEvent);
    }

    // 保存历史
    this.addToHistory(processedEvent);

    // 收集所有监听器
    const listeners: ListenerEntry[] = [];

    // 通配符监听器
    listeners.push(...this.wildcardListeners);

    // 特定事件监听器
    const specificListeners = this.listeners.get(processedEvent.name) || [];
    listeners.push(...specificListeners);

    // 执行监听器
    const promises = listeners.map(async (entry) => {
      try {
        await entry.listener(processedEvent);
        // 如果是一次性监听器，移除它
        if (entry.once) {
          this.off(processedEvent.name, entry.listener);
        }
      } catch (error) {
        console.error(`Error in listener for event ${processedEvent.name}:`, error);
      }
    });

    await Promise.all(promises);
  }

  /**
   * 使用中间件
   */
  use(middleware: EventMiddleware): void {
    this.middleware.push(middleware);
  }

  /**
   * 获取事件历史
   */
  getHistory(limit?: number): IEvent[] {
    return limit ? this.eventHistory.slice(-limit) : [...this.eventHistory];
  }

  /**
   * 清空历史
   */
  clearHistory(): void {
    this.eventHistory = [];
  }

  /**
   * 获取所有监听器信息
   */
  getListeners(): { [eventName: string]: number } {
    const info: { [eventName: string]: number } = {};
    this.listeners.forEach((listeners, eventName) => {
      info[eventName] = listeners.length;
    });
    info['*'] = this.wildcardListeners.length;
    return info;
  }

  private addToHistory(event: IEvent): void {
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }
  }
}

// ============= 装饰器 =============

/**
 * 事件监听器装饰器
 *
 * 用法:
 * class MyComponent {
 *   @OnEvent('user.created')
 *   handleUserCreated(event: IEvent) {
 *     console.log(event);
 *   }
 * }
 */
export function OnEvent(eventName: string, priority = 0) {
  return function (
    target: any,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    // 保存元数据
    if (!target._eventListeners) {
      target._eventListeners = [];
    }
    target._eventListeners.push({
      eventName,
      method: originalMethod,
      priority,
    });

    return descriptor;
  };
}

/**
 * 自动注册类中所有带 @OnEvent 装饰器的方法
 */
export function autoRegisterListeners(instance: any, bus: EventBus): void {
  const proto = Object.getPrototypeOf(instance);
  if (proto._eventListeners) {
    proto._eventListeners.forEach(
      ({ eventName, method, priority }: any) => {
        bus.on(eventName, method.bind(instance), { priority });
      }
    );
  }
}

// ============= 全局事件总线 =============

export const globalEventBus = new EventBus();