"""
Flask API 服务 - 事件驱动架构演示
支持 WebSocket 实时双向通信
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from datetime import datetime
from typing import List, Dict, Any

from core.event import EventBus, Event
from core.event_policy import can_receive_from_frontend, is_sensitive_event
from core.config_loader import config
import events.listeners as listeners_module
from core.event import auto_register_listeners


# 创建Flask应用
app = Flask(__name__)
CORS(app)  # 允许跨域

# 创建SocketIO实例 - 实现WebSocket支持
socketio = SocketIO(
    app,
    cors_allowed_origins=config.websocket.cors_origins,
    async_mode=config.websocket.async_mode
)

# 创建全局事件总线
event_bus = EventBus()

# 事件历史记录（用于演示）
event_history: List[Dict[str, Any]] = []

# WebSocket连接计数
connected_clients = 0


# ============= 中间件 =============

def logging_middleware(event: Event) -> Event:
    """日志中间件 - 记录所有事件"""
    if config.logging.verbose:
        print(f"[{event.timestamp}] Event: {event.name} | Data: {event.data}")

    event_history.append(event.to_dict())
    # 只保留最近N条
    max_history = config.event_system.max_history
    if len(event_history) > max_history:
        event_history.pop(0)
    return event


def websocket_broadcast_middleware(event: Event) -> Event:
    """
    WebSocket广播中间件 - 根据事件scope决定是否推送到前端

    重要：只有后端主动发起的事件才会广播
    来自前端的事件不会自动反弹回去
    """
    # 检查事件来源：如果来自前端，默认不广播（除非监听器创建了新事件）
    if event.metadata.get('source') == 'frontend':
        # 前端发来的事件，仅后端处理，不反弹
        print(f"📥 接收前端事件: {event.name} (仅后端处理)")
        return event

    # 后端主动发起的事件，根据 scope 决定是否广播
    if event.scope in ('broadcast', 'both'):
        # 安全检查：敏感事件给出警告
        if is_sensitive_event(event.name):
            print(f"⚠️  警告: 敏感事件 {event.name} 正在广播到前端！建议使用 scope='local'")

        socketio.emit('event', event.to_dict(), namespace='/')
        print(f"📡 广播事件到前端: {event.name} (scope={event.scope})")
    elif event.scope == 'local':
        print(f"📍 事件 {event.name} 仅后端本地处理 (scope=local)")

    return event


def validation_middleware(event: Event) -> Event:
    """验证中间件 - 为事件添加元数据"""
    event.metadata['validated'] = True
    event.metadata['api_version'] = '1.0'
    return event


# 注册中间件（根据配置）
if config.middleware.enable_logging:
    event_bus.use_middleware(logging_middleware)
if config.middleware.enable_validation:
    event_bus.use_middleware(validation_middleware)
if config.middleware.enable_websocket_broadcast:
    event_bus.use_middleware(websocket_broadcast_middleware)


# ============= 初始化 =============

def init_event_system():
    """初始化事件系统"""
    # 自动注册所有监听器
    auto_register_listeners(listeners_module, event_bus)

    # 注册广播示例（可选）
    # import events.broadcast_examples as broadcast_examples
    # broadcast_examples.set_event_bus(event_bus)
    # auto_register_listeners(broadcast_examples, event_bus)

    print("✓ 事件系统初始化完成")
    print(f"✓ 已注册监听器: {len(event_bus._listeners)} 个事件类型")


# ============= API 路由 =============

@app.route('/api/health', methods=['GET'])
def health_check():
    """健康检查"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'event_system': {
            'listeners_count': sum(len(v) for v in event_bus._listeners.values()),
            'event_types': list(event_bus._listeners.keys()),
            'wildcard_listeners': len(event_bus._wildcard_listeners)
        }
    })


@app.route('/api/events', methods=['POST'])
def emit_event():
    """
    发布事件

    请求体:
    {
        "name": "event.name",
        "data": {"key": "value"},
        "scope": "local" | "broadcast" | "both"  (可选，默认 "broadcast")
    }
    """
    try:
        payload = request.get_json()

        if not payload or 'name' not in payload:
            return jsonify({'error': 'Missing event name'}), 400

        # 创建事件
        event = Event(
            name=payload['name'],
            data=payload.get('data', {}),
            scope=payload.get('scope', config.event_system.default_scope)
        )

        # 发布事件
        results = event_bus.emit(event)

        return jsonify({
            'success': True,
            'event': event.to_dict(),
            'listeners_executed': len(results),
            'results': [str(r) for r in results if r is not None],
            'scope': event.scope
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/events/history', methods=['GET'])
def get_event_history():
    """获取事件历史"""
    limit = request.args.get('limit', config.api.default_history_limit, type=int)
    limit = min(limit, config.api.max_history_limit)  # 限制最大值
    return jsonify({
        'events': event_history[-limit:],
        'total': len(event_history)
    })


@app.route('/api/events/clear', methods=['POST'])
def clear_event_history():
    """清空事件历史"""
    event_history.clear()
    return jsonify({'success': True, 'message': 'Event history cleared'})


@app.route('/api/listeners', methods=['GET'])
def get_listeners():
    """获取所有监听器信息"""
    listeners_info = {}

    for event_name, listeners in event_bus._listeners.items():
        listeners_info[event_name] = [
            {
                'name': listener.__name__ if hasattr(listener, '__name__') else str(listener),
                'priority': priority
            }
            for listener, priority in listeners
        ]

    return jsonify({
        'listeners': listeners_info,
        'wildcard_listeners': len(event_bus._wildcard_listeners)
    })


# ============= WebSocket 事件处理 =============

@socketio.on('connect')
def handle_connect():
    """客户端连接"""
    global connected_clients
    connected_clients += 1
    print(f"✓ WebSocket 客户端已连接 (总数: {connected_clients})")
    emit('connection_status', {
        'status': 'connected',
        'timestamp': datetime.now().isoformat(),
        'message': '已连接到后端事件总线'
    })


@socketio.on('disconnect')
def handle_disconnect():
    """客户端断开"""
    global connected_clients
    connected_clients -= 1
    print(f"✗ WebSocket 客户端已断开 (总数: {connected_clients})")


@socketio.on('emit_event')
def handle_frontend_event(data):
    """处理来自前端的事件"""
    try:
        event_name = data.get('name')

        # 安全检查：验证事件是否允许从前端接收
        if not can_receive_from_frontend(event_name):
            emit('event_error', {
                'error': f'事件 "{event_name}" 不允许从前端发送（私有事件）',
                'event_name': event_name
            })
            print(f"🔒 拒绝前端事件: {event_name}")
            return

        # 创建事件
        event = Event(
            name=event_name,
            data=data.get('data', {}),
            scope=data.get('scope', config.event_system.default_frontend_scope)
        )
        event.metadata['source'] = 'frontend'

        # 发布到后端事件总线
        results = event_bus.emit(event)

        # 响应前端
        emit('event_result', {
            'success': True,
            'event': event.to_dict(),
            'listeners_executed': len(results),
            'scope': event.scope
        })

    except Exception as e:
        emit('event_error', {'error': str(e)})


@socketio.on('subscribe')
def handle_subscribe(data):
    """前端订阅特定事件"""
    event_name = data.get('event_name', '*')
    print(f"📡 前端订阅事件: {event_name}")
    emit('subscribe_success', {'event_name': event_name})


# ============= 启动应用 =============

if __name__ == '__main__':
    init_event_system()
    print("\n" + "="*50)
    print("🚀 EventFrame Backend Server Starting...")
    print("="*50)
    print(f"📡 HTTP Server: http://{config.server.host}:{config.server.port}")
    print(f"🔌 WebSocket Server: ws://{config.server.host}:{config.server.port}")
    print(f"\n📚 API Endpoints:")
    print(f"   - POST   /api/events           发布事件")
    print(f"   - GET    /api/events/history   事件历史")
    print(f"   - GET    /api/listeners        监听器列表")
    print(f"   - GET    /api/health           健康检查")
    print(f"\n🔌 WebSocket Events:")
    print(f"   - emit_event                   前端发送事件")
    print(f"   - event                        后端广播事件")
    print(f"   - subscribe                    订阅事件")
    print("="*50 + "\n")

    socketio.run(
        app,
        debug=config.server.debug,
        host=config.server.host,
        port=config.server.port,
        allow_unsafe_werkzeug=True
    )