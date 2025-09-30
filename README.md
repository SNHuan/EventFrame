# EventFrame - 简洁优雅的事件驱动架构

一个基于 Python + Flask 后端和 React + TypeScript 前端的事件驱动架构框架，通过 WebSocket 实现实时双向通信。

## ✨ 核心特性

- 🎯 **完全事件驱动**：前后端通过事件系统解耦，所有交互基于事件
- 🔄 **实时双向通信**：基于 WebSocket 的实时事件推送
- 🎨 **简洁优雅**：基于协议/接口的鸭子类型设计，高扩展性
- 🔒 **安全机制**：内置事件黑名单和作用域控制
- ⚙️ **灵活配置**：YAML 配置文件管理所有设置
- 📦 **开箱即用**：完整的 Todo 应用示例

## 📁 项目结构

```
EventFrame/
├── backend/                 # Python + Flask 后端
│   ├── core/               # 核心事件系统
│   │   ├── event.py        # Event 基类、EventBus、装饰器
│   │   ├── event_policy.py # 安全策略
│   │   └── config_loader.py # 配置加载器
│   ├── events/             # 事件监听器
│   │   └── todo_events.py  # Todo 应用事件
│   ├── config.yaml         # 配置文件
│   └── app.py             # Flask 应用入口
│
└── frontend/               # React + TypeScript 前端
    ├── src/
    │   ├── core/          # 核心事件系统
    │   │   ├── EventBus.ts        # 前端事件总线
    │   │   └── WebSocketBridge.ts # WebSocket 桥接器
    │   ├── components/    # React 组件
    │   │   └── TodoApp.tsx # Todo 应用组件
    │   ├── api/          # API 层
    │   │   └── todoApi.ts # Todo API（事件驱动）
    │   ├── config.ts     # 前端配置
    │   └── App.tsx       # 应用入口
    └── package.json
```

## 🚀 快速开始

### 后端启动

```bash
cd backend
pip install flask flask-cors flask-socketio pyyaml
python app.py
```

后端将运行在 `http://localhost:5000`

### 前端启动

```bash
cd frontend
npm install
npm run dev
```

前端将运行在 `http://localhost:5173`

## 🎯 核心概念

### 1. 事件系统架构

#### 后端事件系统 (Python)

```python
from core.event import Event, EventBus, on_event

# 创建事件总线
event_bus = EventBus()

# 使用装饰器注册监听器
@on_event("user.created", priority=10)
def handle_user_created(event: Event):
    print(f"用户创建: {event.data}")
    return {"success": True}

# 发布事件
event = Event(
    name="user.created",
    data={"username": "Alice", "email": "alice@example.com"},
    scope="broadcast"  # local | broadcast | both
)
event_bus.emit(event)
```

**事件作用域**：
- `local`：仅后端本地处理
- `broadcast`：仅广播到前端
- `both`：后端处理 + 广播到前端

#### 前端事件系统 (TypeScript)

```typescript
import { globalEventBus } from './core/EventBus';

// 订阅事件
const unsubscribe = globalEventBus.on('user.created', (event) => {
  console.log('收到事件:', event.data);
});

// 发布事件
globalEventBus.emit('user.created', {
  username: 'Alice',
  email: 'alice@example.com'
});

// 取消订阅
unsubscribe();
```

### 2. WebSocket 双向通信

前端通过 `WebSocketBridge` 连接后端：

```typescript
import { createBridge } from './core/WebSocketBridge';

const bridge = createBridge(globalEventBus, {
  url: 'http://localhost:5000',
  autoConnect: true,
  syncLocalEvents: true,   // 同步本地事件到后端
  syncRemoteEvents: true,  // 接收后端推送
  allowedEvents: ['todo.*', 'notification.*'],  // 白名单
  blockedEvents: ['private.*', 'admin.*'],      // 黑名单
});
```

**事件流转**：

```
前端发送事件 → WebSocket → 后端事件总线 → 监听器处理 → 返回广播请求 → WebSocket 广播 → 所有前端客户端
```

### 3. 事件监听器与广播机制

监听器通过返回 `{broadcast: {...}}` 请求广播到前端：

```python
@on_event("todo.created", priority=5)
def broadcast_new_todo(event: Event):
    """处理 Todo 创建并请求广播"""
    # 保存到数据库
    todo = save_todo(event.data)

    # 返回广播请求
    return {
        "broadcast": {
            'name': 'todo.list_updated',
            'data': {
                'action': 'created',
                'todo': todo
            },
            'timestamp': datetime.now().isoformat(),
            'metadata': {'source': 'backend'},
            'scope': 'broadcast'
        }
    }
```

**为什么要这样设计？**

由于 Flask-SocketIO 的 `emit()` 需要在请求上下文中调用，而事件监听器可能在任意上下文执行，因此监听器不直接广播，而是返回广播请求，由 WebSocket 事件处理器（`handle_frontend_event`）在正确的上下文中执行广播。

## 🔒 安全机制

### 事件黑名单

配置文件 `backend/config.yaml`：

```yaml
security:
  blocked_prefixes:
    - "private."
    - "system."
    - "admin."
    - "auth."
    - "internal."
```

前端无法发送这些前缀的事件到后端。

### 事件作用域控制

- 后端事件可以选择是否广播到前端（`scope` 参数）
- 前端事件默认仅后端处理，不会自动反弹
- 监听器创建的新事件可以独立设置作用域

## 📝 Todo 应用示例

完整的 CRUD 操作通过事件驱动实现：

### 前端发送事件

```typescript
// 创建 Todo
TodoApi.createTodo('买牛奶');  // 发送 todo.created 事件

// 完成 Todo
TodoApi.completeTodo(1);       // 发送 todo.completed 事件

// 删除 Todo
TodoApi.deleteTodo(1);         // 发送 todo.deleted 事件
```

### 后端处理并广播

```python
@on_event("todo.created")
def save_todo(event: Event):
    """保存 Todo 到数据库"""
    todo = {...}
    todos_db[todo_id] = todo
    return {"todo_id": todo_id}

@on_event("todo.created", priority=5)
def broadcast_new_todo(event: Event):
    """广播新 Todo 给所有客户端"""
    return {"broadcast": {...}}  # 请求广播
```

### 前端接收更新

```typescript
// 监听 Todo 更新
globalEventBus.on('todo.list_updated', (event) => {
  const { action, todo } = event.data;
  switch (action) {
    case 'created':
      setTodos([...todos, todo]);
      break;
    case 'completed':
      setTodos(todos.map(t => t.id === todo.id ? todo : t));
      break;
    case 'deleted':
      setTodos(todos.filter(t => t.id !== todo.id));
      break;
  }
});
```

## ⚙️ 配置说明

### 后端配置 (`backend/config.yaml`)

```yaml
# 服务器配置
server:
  host: "0.0.0.0"
  port: 5000
  debug: true

# 事件系统配置
event_system:
  max_history: 100
  default_scope: "local"
  default_frontend_scope: "local"

# WebSocket 配置
websocket:
  cors_origins: "*"
  async_mode: "threading"

# 中间件开关
middleware:
  enable_logging: true
  enable_validation: true
  enable_websocket_broadcast: true
```

### 前端配置 (`frontend/src/config.ts`)

```typescript
export const config = {
  api: {
    baseUrl: 'http://localhost:5000',
  },
  websocket: {
    url: 'http://localhost:5000',
    autoConnect: true,
  },
  events: {
    allowedPrefixes: ['todo.*', 'notification.*'],
    blockedPrefixes: ['private.*', 'system.*'],
  },
};
```

## 🎨 核心设计模式

### 1. 发布-订阅模式

事件总线实现了发布-订阅模式，实现组件间解耦。

### 2. 中间件模式

后端事件总线支持中间件链：

```python
def logging_middleware(event: Event) -> Event:
    print(f"事件: {event.name}")
    return event

event_bus.use_middleware(logging_middleware)
```

### 3. 优先级执行

监听器支持优先级，高优先级先执行：

```python
@on_event("user.created", priority=10)  # 先执行
def save_user(event): ...

@on_event("user.created", priority=5)   # 后执行
def send_welcome_email(event): ...
```

### 4. 协议/接口设计

使用 Python Protocol 和 TypeScript Interface 实现鸭子类型：

```python
from typing import Protocol

class EventListener(Protocol):
    def __call__(self, event: Event) -> Any: ...
```

## 📡 API 端点

### REST API

- `GET /api/health` - 健康检查
- `POST /api/events` - 发布事件（HTTP 方式）
- `GET /api/events/history` - 获取事件历史
- `GET /api/listeners` - 获取监听器列表
- `GET /api/todos` - 获取所有 Todos（仅用于初始化）

### WebSocket 事件

- `connect` - 客户端连接
- `disconnect` - 客户端断开
- `emit_event` - 前端发送事件到后端
- `event` - 后端广播事件到前端
- `event_result` - 事件处理结果
- `event_error` - 事件处理错误

## 🛠️ 扩展开发

### 添加新的事件监听器

1. 在 `backend/events/` 下创建新文件
2. 使用 `@on_event` 装饰器注册监听器
3. 在 `app.py` 中导入并注册

```python
# backend/events/user_events.py
from core.event import Event, on_event

@on_event("user.registered")
def handle_user_registration(event: Event):
    user = event.data
    # 处理逻辑
    return {"broadcast": {...}}  # 可选：请求广播
```

### 前端添加新功能

```typescript
// 发送事件
globalEventBus.emit('user.registered', {
  username: 'Alice',
  email: 'alice@example.com'
});

// 监听响应
globalEventBus.on('user.registration_completed', (event) => {
  console.log('注册完成:', event.data);
});
```

## 🔍 调试技巧

### 后端调试

- 开启详细日志：`config.yaml` 中设置 `logging.verbose: true`
- 查看事件历史：`GET /api/events/history`
- 查看监听器列表：`GET /api/listeners`

### 前端调试

- 打开浏览器控制台查看事件流转日志
- 所有事件都会打印详细信息：
  - `📤 同步本地事件到后端`
  - `📨 收到后端事件`
  - `📡 TodoApp 收到 Todo 更新事件`

### 常见问题

**Q: 前端发送事件后没有收到响应？**

A: 检查：
1. WebSocket 是否连接成功（控制台显示 "✓ WebSocket 已连接"）
2. 事件名称是否在白名单中（`allowedEvents`）
3. 后端监听器是否正确返回 `{broadcast: {...}}`

**Q: 多个浏览器窗口不同步？**

A: 确保监听器返回了广播请求 `{broadcast: {...}}`，而不是直接调用 `socketio.emit()`。

## 📄 License

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

**EventFrame** - 让事件驱动开发变得简单优雅 🎯