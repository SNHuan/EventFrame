import { useState, useEffect, useRef } from 'react';
import './App.css';
import { globalEventBus, type IEvent } from './core/EventBus';
import { EventApiClient } from './api/eventApi';
import { createBridge, WebSocketBridge } from './core/WebSocketBridge';

function App() {
  const [localEvents, setLocalEvents] = useState<IEvent[]>([]);
  const [backendEvents, setBackendEvents] = useState<any[]>([]);
  const [backendStatus, setBackendStatus] = useState<string>('检查中...');
  const [wsStatus, setWsStatus] = useState<string>('disconnected');
  const [syncEnabled, setSyncEnabled] = useState<boolean>(true);
  const [selectedEvent, setSelectedEvent] = useState<string>('user.created');
  const [eventData, setEventData] = useState<string>('{"username": "Alice", "email": "alice@example.com"}');
  const bridgeRef = useRef<WebSocketBridge | null>(null);

  // 初始化本地事件监听器
  useEffect(() => {
    // 监听所有事件并更新UI
    const unsubscribe = globalEventBus.on('*', (event) => {
      console.log('🎯 本地事件:', event);
      setLocalEvents((prev) => [...prev, event].slice(-10)); // 只保留最近10条
    });

    // 注册示例监听器
    globalEventBus.on('user.created', (event) => {
      console.log('👤 用户创建:', event.data);
    }, { priority: 10 });

    globalEventBus.on('order.placed', (event) => {
      console.log('📦 订单创建:', event.data);
    }, { priority: 5 });

    globalEventBus.on('notification.send', (event) => {
      console.log('🔔 发送通知:', event.data);
    });

    return () => unsubscribe();
  }, []);

  // 初始化WebSocket桥接器
  useEffect(() => {
    // 创建桥接器
    bridgeRef.current = createBridge(globalEventBus, {
      url: 'http://localhost:5000',
      autoConnect: true,
      syncLocalEvents: syncEnabled,
      syncRemoteEvents: true,
    });

    // 监听连接状态
    const unsubscribe = bridgeRef.current.onStatusChange((status) => {
      setWsStatus(status);
      console.log('🔌 WebSocket 状态:', status);
    });

    return () => {
      unsubscribe();
      bridgeRef.current?.disconnect();
    };
  }, [syncEnabled]);

  // 检查后端状态
  useEffect(() => {
    checkBackendHealth();
  }, []);

  const checkBackendHealth = async () => {
    try {
      const health = await EventApiClient.healthCheck();
      setBackendStatus(`✅ 已连接 | ${health.event_system.listeners_count} 个监听器`);
    } catch (error) {
      setBackendStatus('❌ 未连接 (请启动后端服务)');
    }
  };

  const emitLocalEvent = () => {
    try {
      const data = JSON.parse(eventData);
      globalEventBus.emit(selectedEvent, data);
    } catch (error) {
      alert('数据格式错误，请输入有效的JSON');
    }
  };

  const emitBackendEvent = async () => {
    try {
      const data = JSON.parse(eventData);
      const response = await EventApiClient.emitToBackend(selectedEvent, data);
      console.log('Backend response:', response);
      alert(`✅ 事件已发送到后端\\n执行了 ${response.listeners_executed} 个监听器`);
      await refreshBackendHistory();
    } catch (error: any) {
      alert(`❌ 发送失败: ${error.message}`);
    }
  };

  const refreshBackendHistory = async () => {
    try {
      const history = await EventApiClient.getHistory(10);
      setBackendEvents(history.events);
    } catch (error) {
      console.error('获取后端历史失败:', error);
    }
  };

  const clearLocalHistory = () => {
    setLocalEvents([]);
    globalEventBus.clearHistory();
  };

  const clearBackendHistory = async () => {
    try {
      await EventApiClient.clearHistory();
      setBackendEvents([]);
    } catch (error) {
      console.error('清空后端历史失败:', error);
    }
  };

  return (
    <div className="app">
      <header className="header">
        <h1>🎯 EventFrame</h1>
        <p>简洁优雅的事件驱动架构演示</p>
      </header>

      <div className="status-bar">
        <div className="status-item">
          <strong>HTTP:</strong> {backendStatus}
        </div>
        <div className="status-item">
          <strong>WebSocket:</strong>{' '}
          {wsStatus === 'connected' ? '✅ 已连接' :
           wsStatus === 'connecting' ? '🔄 连接中...' :
           '❌ 未连接'}
        </div>
        <div className="status-item">
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              checked={syncEnabled}
              onChange={(e) => setSyncEnabled(e.target.checked)}
            />
            <span>自动同步到后端</span>
          </label>
        </div>
        <button onClick={checkBackendHealth} className="btn-small">
          🔄 刷新
        </button>
      </div>

      <div className="main-content">
        {/* 事件发送面板 */}
        <div className="panel">
          <h2>📤 发送事件</h2>

          <div className="form-group">
            <label>事件类型:</label>
            <select
              value={selectedEvent}
              onChange={(e) => setSelectedEvent(e.target.value)}
              className="select"
            >
              <option value="user.created">user.created - 用户创建</option>
              <option value="user.updated">user.updated - 用户更新</option>
              <option value="user.deleted">user.deleted - 用户删除</option>
              <option value="order.placed">order.placed - 订单创建</option>
              <option value="notification.send">notification.send - 发送通知</option>
            </select>
          </div>

          <div className="form-group">
            <label>事件数据 (JSON):</label>
            <textarea
              value={eventData}
              onChange={(e) => setEventData(e.target.value)}
              className="textarea"
              rows={4}
              placeholder='{"key": "value"}'
            />
          </div>

          <div className="button-group">
            <button onClick={emitLocalEvent} className="btn btn-primary">
              🖥️ 发送到本地
            </button>
            <button onClick={emitBackendEvent} className="btn btn-secondary">
              🌐 发送到后端
            </button>
          </div>
        </div>

        {/* 本地事件历史 */}
        <div className="panel">
          <div className="panel-header">
            <h2>🖥️ 本地事件历史</h2>
            <button onClick={clearLocalHistory} className="btn-small">
              清空
            </button>
          </div>
          <div className="event-list">
            {localEvents.length === 0 ? (
              <div className="empty-state">暂无事件</div>
            ) : (
              localEvents.map((event, index) => (
                <div key={index} className="event-item">
                  <div className="event-name">{event.name}</div>
                  <div className="event-time">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </div>
                  <div className="event-data">
                    {JSON.stringify(event.data, null, 2)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 后端事件历史 */}
        <div className="panel">
          <div className="panel-header">
            <h2>🌐 后端事件历史</h2>
            <div>
              <button onClick={refreshBackendHistory} className="btn-small">
                🔄 刷新
              </button>
              <button onClick={clearBackendHistory} className="btn-small">
                清空
              </button>
            </div>
          </div>
          <div className="event-list">
            {backendEvents.length === 0 ? (
              <div className="empty-state">暂无事件（点击刷新加载）</div>
            ) : (
              backendEvents.map((event, index) => (
                <div key={index} className="event-item">
                  <div className="event-name">{event.name}</div>
                  <div className="event-time">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </div>
                  <div className="event-data">
                    {JSON.stringify(event.data, null, 2)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <footer className="footer">
        <p>💡 提示: 打开浏览器控制台查看详细日志</p>
        <p style={{ marginTop: '10px', fontSize: '0.9rem' }}>
          🔌 WebSocket实时互通: 本地事件{syncEnabled ? '会' : '不会'}自动同步到后端 | 后端事件会实时推送到前端
        </p>
      </footer>
    </div>
  );
}

export default App;