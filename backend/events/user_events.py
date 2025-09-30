"""
用户相关事件定义

展示如何创建自定义事件类
"""

from core.event import Event
from dataclasses import dataclass


@dataclass
class UserCreatedEvent(Event):
    """用户创建事件"""

    def __post_init__(self):
        self.name = "user.created"
        super().__post_init__()


@dataclass
class UserUpdatedEvent(Event):
    """用户更新事件"""

    def __post_init__(self):
        self.name = "user.updated"
        super().__post_init__()


@dataclass
class UserDeletedEvent(Event):
    """用户删除事件"""

    def __post_init__(self):
        self.name = "user.deleted"
        super().__post_init__()


@dataclass
class OrderPlacedEvent(Event):
    """订单创建事件"""

    def __post_init__(self):
        self.name = "order.placed"
        super().__post_init__()


@dataclass
class NotificationEvent(Event):
    """通知事件"""

    def __post_init__(self):
        self.name = "notification.send"
        super().__post_init__()