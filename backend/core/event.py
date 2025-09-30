"""
事件系统核心 - 简洁优雅的事件驱动架构

设计理念:
1. 抽象基类定义契约
2. 鸭子类型支持高扩展性
3. 装饰器模式简化使用
4. 异步支持提升性能
"""

from abc import ABC, abstractmethod
from typing import Any, Callable, Dict, List, Optional, Protocol
from dataclasses import dataclass, field
from datetime import datetime
import asyncio


# ============= 事件协议 (鸭子类型支持) =============

class EventProtocol(Protocol):
    """事件协议 - 任何具有这些属性的对象都可以作为事件"""
    name: str
    timestamp: datetime
    data: Dict[str, Any]


# ============= 事件基类 =============

@dataclass
class Event(ABC):
    """事件抽象基类"""
    name: str
    data: Dict[str, Any] = field(default_factory=dict)
    timestamp: datetime = field(default_factory=datetime.now)
    metadata: Dict[str, Any] = field(default_factory=dict)
    scope: str = 'local'  # 'local' | 'broadcast' | 'both'

    def __post_init__(self):
        """事件创建后的钩子"""
        if not self.name:
            self.name = self.__class__.__name__

    def to_dict(self) -> Dict[str, Any]:
        """序列化为字典"""
        return {
            "name": self.name,
            "data": self.data,
            "timestamp": self.timestamp.isoformat(),
            "metadata": self.metadata,
            "scope": self.scope
        }


# ============= 监听器协议 =============

class ListenerProtocol(Protocol):
    """监听器协议 - 支持鸭子类型"""
    def __call__(self, event: EventProtocol) -> Any: ...


# ============= 监听器基类 =============

class EventListener(ABC):
    """事件监听器抽象基类"""

    @abstractmethod
    def handle(self, event: Event) -> Any:
        """处理事件"""
        pass

    def __call__(self, event: Event) -> Any:
        """使监听器可调用"""
        return self.handle(event)


class AsyncEventListener(ABC):
    """异步事件监听器"""

    @abstractmethod
    async def handle(self, event: Event) -> Any:
        """异步处理事件"""
        pass

    async def __call__(self, event: Event) -> Any:
        return await self.handle(event)


# ============= 事件总线 =============

class EventBus:
    """
    事件总线 - 核心调度器

    特性:
    - 同步/异步监听器支持
    - 优先级队列
    - 通配符订阅
    - 中间件支持
    """

    def __init__(self):
        self._listeners: Dict[str, List[tuple[Callable, int]]] = {}  # {event_name: [(listener, priority)]}
        self._middleware: List[Callable] = []
        self._wildcard_listeners: List[tuple[Callable, int]] = []

    def subscribe(
        self,
        event_name: str,
        listener: Callable[[Event], Any],
        priority: int = 0
    ) -> None:
        """
        订阅事件

        Args:
            event_name: 事件名称，支持通配符 "*"
            listener: 监听器函数或对象
            priority: 优先级（数字越大越先执行）
        """
        if event_name == "*":
            self._wildcard_listeners.append((listener, priority))
            self._wildcard_listeners.sort(key=lambda x: x[1], reverse=True)
        else:
            if event_name not in self._listeners:
                self._listeners[event_name] = []
            self._listeners[event_name].append((listener, priority))
            self._listeners[event_name].sort(key=lambda x: x[1], reverse=True)

    def unsubscribe(self, event_name: str, listener: Callable) -> None:
        """取消订阅"""
        if event_name == "*":
            self._wildcard_listeners = [
                (l, p) for l, p in self._wildcard_listeners if l != listener
            ]
        elif event_name in self._listeners:
            self._listeners[event_name] = [
                (l, p) for l, p in self._listeners[event_name] if l != listener
            ]

    def use_middleware(self, middleware: Callable[[Event], Event]) -> None:
        """添加中间件"""
        self._middleware.append(middleware)

    def emit(self, event: Event) -> List[Any]:
        """
        发布事件（同步）

        Returns:
            所有监听器的返回值列表
        """
        # 应用中间件
        for middleware in self._middleware:
            event = middleware(event)

        results = []

        # 执行通配符监听器
        for listener, _ in self._wildcard_listeners:
            results.append(self._execute_listener(listener, event))

        # 执行特定事件监听器
        if event.name in self._listeners:
            for listener, _ in self._listeners[event.name]:
                results.append(self._execute_listener(listener, event))

        return results

    async def emit_async(self, event: Event) -> List[Any]:
        """发布事件（异步）"""
        # 应用中间件
        for middleware in self._middleware:
            event = middleware(event)

        tasks = []

        # 收集所有监听器
        all_listeners = []
        all_listeners.extend(self._wildcard_listeners)
        if event.name in self._listeners:
            all_listeners.extend(self._listeners[event.name])

        # 并发执行
        for listener, _ in all_listeners:
            if asyncio.iscoroutinefunction(listener) or \
               (hasattr(listener, 'handle') and asyncio.iscoroutinefunction(listener.handle)):
                tasks.append(self._execute_listener_async(listener, event))
            else:
                tasks.append(asyncio.to_thread(self._execute_listener, listener, event))

        return await asyncio.gather(*tasks, return_exceptions=True)

    def _execute_listener(self, listener: Callable, event: Event) -> Any:
        """执行单个监听器"""
        try:
            return listener(event)
        except Exception as e:
            print(f"Error in listener {listener}: {e}")
            return None

    async def _execute_listener_async(self, listener: Callable, event: Event) -> Any:
        """异步执行单个监听器"""
        try:
            if hasattr(listener, 'handle'):
                return await listener.handle(event)
            return await listener(event)
        except Exception as e:
            print(f"Error in async listener {listener}: {e}")
            return None


# ============= 装饰器 =============

def on_event(event_name: str, bus: Optional[EventBus] = None, priority: int = 0):
    """
    事件监听器装饰器

    用法:
        @on_event("user.created")
        def handle_user_created(event):
            print(f"User created: {event.data}")
    """
    def decorator(func: Callable) -> Callable:
        if bus:
            bus.subscribe(event_name, func, priority)
        # 保存元数据，方便后续手动订阅
        func._event_name = event_name
        func._event_priority = priority
        return func
    return decorator


# ============= 工具函数 =============

def auto_register_listeners(module, bus: EventBus) -> None:
    """
    自动注册模块中所有带 @on_event 装饰器的监听器

    Args:
        module: Python模块对象
        bus: 事件总线实例
    """
    for name in dir(module):
        obj = getattr(module, name)
        if hasattr(obj, '_event_name'):
            bus.subscribe(
                obj._event_name,
                obj,
                getattr(obj, '_event_priority', 0)
            )