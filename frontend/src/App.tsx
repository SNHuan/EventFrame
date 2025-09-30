import { useEffect, useRef } from 'react';
import './App.css';
import { globalEventBus } from './core/EventBus';
import { createBridge, type WebSocketBridge } from './core/WebSocketBridge';
import { TodoApp } from './components/TodoApp';

function App() {
  const bridgeRef = useRef<WebSocketBridge | null>(null);

  // 初始化 WebSocket 桥接器
  useEffect(() => {
    // 创建桥接器 - 双向事件同步
    bridgeRef.current = createBridge(globalEventBus, {
      url: 'http://localhost:5000',
      autoConnect: true,
      syncLocalEvents: true,   // 同步 Todo 事件到后端
      syncRemoteEvents: true,  // 接收后端推送
      allowedEvents: ['todo.*', 'notification.*', 'public.*'], // Todo 相关事件
      blockedEvents: ['private.*', 'system.*', 'admin.*', 'auth.*'],
    });

    // 监听连接状态
    const unsubscribe = bridgeRef.current.onStatusChange((status) => {
      console.log('🔌 WebSocket 状态:', status);
    });

    return () => {
      unsubscribe();
      bridgeRef.current?.disconnect();
    };
  }, []);

  return (
    <div className="app">
      <header className="header">
        <h1>EventFrame Todo</h1>
        <p>事件驱动架构示例</p>
      </header>

      <TodoApp />
    </div>
  );
}

export default App;