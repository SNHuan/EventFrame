/**
 * EventFrame 前端配置
 */

// ============= 后端连接配置 =============
export const BACKEND_CONFIG = {
  // HTTP API 地址
  apiUrl: 'http://localhost:5000',

  // WebSocket 地址
  wsUrl: 'http://localhost:5000',
};

// ============= 事件系统配置 =============
export const EVENT_CONFIG = {
  // 本地事件历史最大保留数量
  maxLocalHistory: 10,

  // 后端事件历史查询数量
  backendHistoryLimit: 10,
};

// ============= WebSocket 配置 =============
export const WEBSOCKET_CONFIG = {
  // 是否自动连接
  autoConnect: true,

  // 是否自动同步本地事件到后端（建议关闭，按需发送）
  syncLocalEvents: false,

  // 是否接收后端事件推送
  syncRemoteEvents: true,

  // 允许同步的事件列表（白名单，支持通配符）
  allowedEvents: [
    'user.*',
    'order.*',
    'notification.*',
    'public.*',
  ],

  // 禁止同步的事件列表（黑名单）
  blockedEvents: [
    'private.*',
    'system.*',
    'admin.*',
    'auth.*',
    'internal.*',
  ],
};

// ============= UI 配置 =============
export const UI_CONFIG = {
  // 默认发送模式 (local | backend | both)
  defaultSendMode: 'local' as 'local' | 'backend' | 'both',

  // 默认后端作用域 (local | broadcast | both)
  defaultBackendScope: 'broadcast' as 'local' | 'broadcast' | 'both',

  // 默认事件类型
  defaultEventType: 'user.created',

  // 默认事件数据
  defaultEventData: {
    username: 'Alice',
    email: 'alice@example.com',
  },
};

// ============= 事件类型定义 =============
export const EVENT_TYPES = {
  // 公开事件（可前后端互通）
  public: [
    { value: 'user.created', label: 'user.created - 用户创建' },
    { value: 'user.updated', label: 'user.updated - 用户更新' },
    { value: 'user.deleted', label: 'user.deleted - 用户删除' },
    { value: 'order.placed', label: 'order.placed - 订单创建' },
    { value: 'notification.send', label: 'notification.send - 发送通知' },
    { value: 'public.test', label: 'public.test - 公开测试事件' },
  ],

  // 私有事件（仅本地）
  private: [
    { value: 'private.sensitive', label: 'private.sensitive - 敏感操作' },
    { value: 'system.internal', label: 'system.internal - 系统内部' },
    { value: 'admin.action', label: 'admin.action - 管理员操作' },
  ],
};

// ============= 开发模式配置 =============
export const DEV_CONFIG = {
  // 是否启用详细日志
  verboseLogging: true,

  // 是否显示调试信息
  showDebugInfo: true,
};