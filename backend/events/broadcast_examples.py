"""
广播事件示例 - 展示后端监听器如何主动广播事件到前端
"""

from core.event import Event, on_event, EventBus


# 全局事件总线引用（需要在 app.py 中注入）
_event_bus: EventBus = None


def set_event_bus(bus: EventBus):
    """设置事件总线引用"""
    global _event_bus
    _event_bus = bus


# ============= 示例 1: 用户创建后广播通知 =============

@on_event("user.created")
def notify_all_users_on_new_user(event: Event):
    """
    当有新用户创建时，广播通知给所有在线用户

    前端发送: user.created (仅后端处理)
    后端主动广播: user.notification (推送到所有前端)
    """
    user_data = event.data
    print(f"👤 处理用户创建: {user_data.get('username')}")

    # 后端监听器主动创建一个新的通知事件
    notification_event = Event(
        name="user.notification",
        data={
            "type": "new_user",
            "message": f"欢迎新用户 {user_data.get('username')} 加入！",
            "username": user_data.get('username'),
        },
        scope="broadcast"  # 这个新事件会广播到前端
    )

    # 发布新事件（会被广播中间件捕获并推送）
    if _event_bus:
        _event_bus.emit(notification_event)

    return {"notified": True}


# ============= 示例 2: 订单处理后广播状态更新 =============

@on_event("order.placed")
def process_and_broadcast_order_status(event: Event):
    """
    订单创建后，处理订单，然后广播状态更新
    """
    order_data = event.data
    order_id = order_data.get('order_id')

    print(f"📦 处理订单: {order_id}")

    # 模拟订单处理
    # ... 数据库操作、支付处理等 ...

    # 处理完成后，广播订单状态更新
    status_event = Event(
        name="order.status_updated",
        data={
            "order_id": order_id,
            "status": "confirmed",
            "message": "订单已确认",
        },
        scope="broadcast"  # 广播给所有前端
    )

    if _event_bus:
        _event_bus.emit(status_event)

    return {"order_processed": True}


# ============= 示例 3: 仅后端处理，不广播 =============

@on_event("user.deleted")
def cleanup_user_data(event: Event):
    """
    用户删除后仅清理后端数据，不需要通知前端
    """
    user_id = event.data.get('user_id')
    print(f"🗑️  清理用户数据: {user_id}")

    # 清理数据库、缓存等
    # ... 后端逻辑 ...

    # 不创建新事件，不广播
    return {"cleaned": True}


# ============= 示例 4: 条件性广播 =============

@on_event("order.placed")
def notify_admin_on_large_order(event: Event):
    """
    只有大额订单才通知管理员
    """
    order_data = event.data
    amount = order_data.get('amount', 0)

    # 大额订单（>1000）才广播
    if amount > 1000:
        print(f"💰 检测到大额订单: ${amount}")

        admin_alert = Event(
            name="admin.alert",
            data={
                "type": "large_order",
                "order_id": order_data.get('order_id'),
                "amount": amount,
                "message": f"检测到大额订单: ${amount}",
            },
            scope="broadcast"
        )

        if _event_bus:
            _event_bus.emit(admin_alert)

        return {"admin_notified": True}

    return {"admin_notified": False}