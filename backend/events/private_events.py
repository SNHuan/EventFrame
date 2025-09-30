"""
私有事件示例 - 仅限后端内部使用

这些事件不会广播到前端，也不接受前端发送
"""

from core.event import Event, on_event
from dataclasses import dataclass


@dataclass
class PrivateUserPasswordChangedEvent(Event):
    """私有事件：用户密码修改"""

    def __post_init__(self):
        self.name = "private.user.password_changed"
        super().__post_init__()


@dataclass
class SystemHealthCheckEvent(Event):
    """系统事件：健康检查"""

    def __post_init__(self):
        self.name = "system.health_check"
        super().__post_init__()


@dataclass
class AdminActionEvent(Event):
    """管理员事件：敏感操作"""

    def __post_init__(self):
        self.name = "admin.action"
        super().__post_init__()


# 私有事件监听器示例
@on_event("private.user.password_changed")
def handle_password_change(event: Event):
    """处理密码修改 - 仅后端"""
    print(f"🔐 [私有] 密码已修改: {event.data.get('user_id')}")
    return {"logged": True, "secure": True}


@on_event("system.health_check")
def handle_system_check(event: Event):
    """系统健康检查 - 仅后端"""
    print(f"🏥 [系统] 健康检查: {event.data}")
    return {"status": "healthy"}


@on_event("admin.action")
def handle_admin_action(event: Event):
    """管理员操作 - 仅后端"""
    print(f"👑 [管理员] 操作: {event.data.get('action')}")
    return {"logged": True, "admin": True}