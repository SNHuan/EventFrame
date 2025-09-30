"""
事件安全策略 - 简化版

职责：仅做安全验证，防止恶意事件
流转控制由 event.scope 负责
"""

from .config_loader import config


def can_receive_from_frontend(event_name: str) -> bool:
    """
    安全检查：前端是否允许发送此事件

    简单规则：只要不在黑名单就允许
    """
    blocked_prefixes = config.security.blocked_prefixes or []
    for prefix in blocked_prefixes:
        if event_name.startswith(prefix):
            return False
    return True


def is_sensitive_event(event_name: str) -> bool:
    """
    检查是否是敏感事件
    敏感事件建议使用 scope='local'
    """
    sensitive_prefixes = config.security.sensitive_prefixes or []
    for prefix in sensitive_prefixes:
        if event_name.startswith(prefix):
            return True
    return False