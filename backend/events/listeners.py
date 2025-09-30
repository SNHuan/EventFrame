"""
事件监听器定义

展示三种监听器实现方式:
1. 装饰器函数 (最简洁)
2. 类监听器 (面向对象)
3. 通配符监听器 (监听所有事件)
"""

from core.event import Event, EventListener, on_event


# ============= 方式1: 装饰器函数 (推荐) =============

@on_event("user.created", priority=10)
def send_welcome_email(event: Event):
    """用户创建时发送欢迎邮件"""
    user_data = event.data
    print(f"📧 发送欢迎邮件给: {user_data.get('email', 'N/A')}")
    return {"email_sent": True, "to": user_data.get('email')}


@on_event("user.created", priority=5)
def create_user_profile(event: Event):
    """用户创建时初始化个人资料"""
    user_data = event.data
    print(f"👤 创建用户资料: {user_data.get('username', 'N/A')}")
    return {"profile_created": True}


@on_event("user.updated")
def log_user_update(event: Event):
    """记录用户更新日志"""
    print(f"📝 用户更新日志: {event.data}")
    return {"logged": True}


@on_event("user.deleted")
def cleanup_user_data(event: Event):
    """用户删除时清理数据"""
    user_id = event.data.get('user_id')
    print(f"🗑️  清理用户数据: {user_id}")
    return {"cleaned_up": True}


@on_event("order.placed", priority=10)
def process_payment(event: Event):
    """处理订单支付"""
    order_data = event.data
    print(f"💳 处理支付: 订单#{order_data.get('order_id')}, "
          f"金额: ${order_data.get('amount', 0)}")
    return {"payment_processed": True}


@on_event("order.placed", priority=5)
def send_order_confirmation(event: Event):
    """发送订单确认"""
    order_data = event.data
    print(f"📦 发送订单确认: {order_data.get('order_id')}")
    return {"confirmation_sent": True}


@on_event("order.placed", priority=3)
def update_inventory(event: Event):
    """更新库存"""
    items = event.data.get('items', [])
    print(f"📊 更新库存: {len(items)} 个商品")
    return {"inventory_updated": True}


@on_event("notification.send")
def send_notification(event: Event):
    """发送通知"""
    notification_data = event.data
    print(f"🔔 发送通知: {notification_data.get('message', 'N/A')}")
    return {"notification_sent": True}


# ============= 方式2: 类监听器 (面向对象) =============

class EmailServiceListener(EventListener):
    """邮件服务监听器 - 演示类监听器"""

    def __init__(self, smtp_host: str = "localhost"):
        self.smtp_host = smtp_host

    def handle(self, event: Event):
        """处理邮件发送事件"""
        print(f"📧 [EmailService@{self.smtp_host}] 处理事件: {event.name}")
        return {"service": "email", "status": "sent"}


class AnalyticsListener(EventListener):
    """数据分析监听器"""

    def __init__(self):
        self.event_count = 0

    def handle(self, event: Event):
        """收集分析数据"""
        self.event_count += 1
        print(f"📈 [Analytics] 事件计数: {self.event_count} | 类型: {event.name}")
        return {"analytics": "tracked", "count": self.event_count}


# ============= 方式3: 通配符监听器 =============

@on_event("*", priority=100)
def global_event_logger(event: Event):
    """全局事件日志 - 监听所有事件"""
    print(f"🌍 [Global] {event.timestamp.strftime('%H:%M:%S')} | "
          f"{event.name} | {len(event.data)} 个数据字段")


# ============= 鸭子类型演示 =============

class CustomLogger:
    """自定义日志器 - 不继承EventListener，但符合协议"""

    def __call__(self, event: Event):
        """实现可调用协议"""
        print(f"🦆 [DuckType] 自定义日志: {event.name}")
        return {"custom_logger": True}


# 创建实例（需要手动注册）
email_service = EmailServiceListener("smtp.example.com")
analytics_service = AnalyticsListener()
custom_logger = CustomLogger()


# ============= 辅助函数 =============

def register_class_listeners(bus):
    """手动注册类监听器"""
    bus.subscribe("*", email_service, priority=2)
    bus.subscribe("*", analytics_service, priority=1)
    bus.subscribe("*", custom_logger, priority=0)