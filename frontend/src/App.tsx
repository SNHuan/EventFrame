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
  const [selectedEvent, setSelectedEvent] = useState<string>('user.created');
  const [eventData, setEventData] = useState<string>('{"username": "Alice", "email": "alice@example.com"}');
  const [sendMode, setSendMode] = useState<'local' | 'backend' | 'both'>('local');
  const [backendScope, setBackendScope] = useState<'local' | 'broadcast' | 'both'>('broadcast');
  const bridgeRef = useRef<WebSocketBridge | null>(null);

  // 初始化本地事件监听器
  useEffect(() => {
    // 监听所有事件并更新UI
    const unsubscribeAll = globalEventBus.on('*', (event) => {
      console.log('🎯 本地事件:', event);
      setLocalEvents((prev) => [...prev, event].slice(-10)); // 只保留最近10条
    });

    // 注册示例监听器
    const unsubscribeUser = globalEventBus.on('user.created', (event) => {
      console.log('👤 用户创建:', event.data);
    }, { priority: 10 });

    const unsubscribeOrder = globalEventBus.on('order.placed', (event) => {
      console.log('📦 订单创建:', event.data);
    }, { priority: 5 });

    const unsubscribeNotification = globalEventBus.on('notification.send', (event) => {
      console.log('🔔 发送通知:', event.data);
    });

    // 清理所有监听器
    return () => {
      unsubscribeAll();
      unsubscribeUser();
      unsubscribeOrder();
      unsubscribeNotification();
    };
  }, []);

  // 初始化WebSocket桥接器
  useEffect(() => {
    // 创建桥接器 - 只接收后端事件，不自动同步本地事件
    bridgeRef.current = createBridge(globalEventBus, {
      url: 'http://localhost:5000',
      autoConnect: true,
      syncLocalEvents: false, // 关闭自动同步
      syncRemoteEvents: true,  // 接收后端推送
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
  }, []);

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

  const emitEvent = async () => {
    try {
      const data = JSON.parse(eventData);

      if (sendMode === 'local') {
        // 仅前端本地
        globalEventBus.emit(selectedEvent, data);
        console.log('📍 仅前端流转');
      } else if (sendMode === 'backend') {
        // 仅发送到后端
        const response = await EventApiClient.emitToBackend(selectedEvent, data, backendScope);
        console.log('🌐 仅发送到后端:', response);
        const scopeText = backendScope === 'local' ? '仅后端本地' :
                         backendScope === 'broadcast' ? '已广播到其他前端' :
                         '后端本地+广播';
        alert(`✅ 后端处理完成 (${scopeText})\\n执行了 ${response.listeners_executed} 个监听器`);
        await refreshBackendHistory();
      } else if (sendMode === 'both') {
        // 前端和后端都发送
        globalEventBus.emit(selectedEvent, data);
        const response = await EventApiClient.emitToBackend(selectedEvent, data, backendScope);
        console.log('🔄 前端+后端同时处理:', response);
        const scopeText = backendScope === 'local' ? '仅后端本地' :
                         backendScope === 'broadcast' ? '已广播到其他前端' :
                         '后端本地+广播';
        alert(`✅ 前后端都已处理 (${scopeText})\\n后端执行了 ${response.listeners_executed} 个监听器`);
        await refreshBackendHistory();
      }
    } catch (error: any) {
      alert(`❌ 错误: ${error.message}`);
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
          <span style={{ fontSize: '0.85rem', marginLeft: '8px', opacity: 0.7 }}>
            (接收后端推送)
          </span>
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
              <optgroup label="✅ 公开事件 (可互通)">
                <option value="user.created">user.created - 用户创建</option>
                <option value="user.updated">user.updated - 用户更新</option>
                <option value="user.deleted">user.deleted - 用户删除</option>
                <option value="order.placed">order.placed - 订单创建</option>
                <option value="notification.send">notification.send - 发送通知</option>
                <option value="public.test">public.test - 公开测试事件</option>
              </optgroup>
              <optgroup label="🔒 私有事件 (仅本地)">
                <option value="private.sensitive">private.sensitive - 敏感操作</option>
                <option value="system.internal">system.internal - 系统内部</option>
                <option value="admin.action">admin.action - 管理员操作</option>
              </optgroup>
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

          <div className="form-group">
            <label>发送模式:</label>
            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="sendMode"
                  value="local"
                  checked={sendMode === 'local'}
                  onChange={(e) => setSendMode(e.target.value as any)}
                />
                <span>🖥️ 仅前端</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="sendMode"
                  value="backend"
                  checked={sendMode === 'backend'}
                  onChange={(e) => setSendMode(e.target.value as any)}
                />
                <span>🌐 仅后端</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="sendMode"
                  value="both"
                  checked={sendMode === 'both'}
                  onChange={(e) => setSendMode(e.target.value as any)}
                />
                <span>🔄 前后端都发</span>
              </label>
            </div>
          </div>

          {sendMode !== 'local' && (
            <div className="form-group" style={{ marginTop: '10px', paddingLeft: '10px', borderLeft: '3px solid #667eea' }}>
              <label style={{ fontSize: '0.9rem' }}>后端处理后:</label>
              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontSize: '0.9rem' }}>
                  <input
                    type="radio"
                    name="backendScope"
                    value="local"
                    checked={backendScope === 'local'}
                    onChange={(e) => setBackendScope(e.target.value as any)}
                  />
                  <span>📍 仅后端本地</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontSize: '0.9rem' }}>
                  <input
                    type="radio"
                    name="backendScope"
                    value="broadcast"
                    checked={backendScope === 'broadcast'}
                    onChange={(e) => setBackendScope(e.target.value as any)}
                  />
                  <span>📡 广播到前端</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontSize: '0.9rem' }}>
                  <input
                    type="radio"
                    name="backendScope"
                    value="both"
                    checked={backendScope === 'both'}
                    onChange={(e) => setBackendScope(e.target.value as any)}
                  />
                  <span>🔄 都执行</span>
                </label>
              </div>
            </div>
          )}

          <button onClick={emitEvent} className="btn btn-primary" style={{ width: '100%' }}>
            📤 发送事件
            {sendMode === 'local' && ' (仅前端)'}
            {sendMode === 'backend' && ' (仅后端)'}
            {sendMode === 'both' && ' (前后端)'}
          </button>
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
          📍 三种模式: 🖥️ 仅前端本地流转 | 🌐 仅发送到后端处理 | 🔄 前后端同时处理
        </p>
        <p style={{ marginTop: '5px', fontSize: '0.85rem', opacity: 0.8 }}>
          后端事件会通过WebSocket自动推送到前端显示
        </p>
      </footer>
    </div>
  );
}

export default App;