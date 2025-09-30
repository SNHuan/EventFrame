"""
Todo 应用事件定义 - 实际应用示例
"""

from core.event import Event, on_event
from dataclasses import dataclass
from typing import Dict, Any


# ============= Todo 事件定义 =============

@dataclass
class TodoCreatedEvent(Event):
    """待办事项创建事件"""
    def __post_init__(self):
        self.name = "todo.created"
        super().__post_init__()


@dataclass
class TodoCompletedEvent(Event):
    """待办事项完成事件"""
    def __post_init__(self):
        self.name = "todo.completed"
        super().__post_init__()


@dataclass
class TodoDeletedEvent(Event):
    """待办事项删除事件"""
    def __post_init__(self):
        self.name = "todo.deleted"
        super().__post_init__()


# ============= 全局 Todo 存储（模拟数据库）=============

todos_db: Dict[int, Dict[str, Any]] = {}
todo_id_counter = 1


# ============= 事件监听器 =============

@on_event("todo.created", priority=10)
def save_todo_to_db(event: Event):
    """保存 Todo 到数据库"""
    global todo_id_counter
    todo_data = event.data

    todo_id = todo_id_counter
    todo_id_counter += 1

    todos_db[todo_id] = {
        "id": todo_id,
        "title": todo_data.get("title"),
        "completed": False,
        "created_at": event.timestamp.isoformat()
    }

    print(f"✅ Todo 已保存到数据库: #{todo_id} - {todo_data.get('title')}")
    return {"todo_id": todo_id, "saved": True}


@on_event("todo.created", priority=5)
def broadcast_new_todo(event: Event):
    """请求广播新 Todo 给所有客户端"""
    from datetime import datetime

    # 获取刚创建的 Todo ID（从高优先级监听器返回值）
    # 这里简化处理，直接从数据库获取最新的
    if todos_db:
        latest_id = max(todos_db.keys())
        todo = todos_db[latest_id]

        # 返回广播请求，由 handle_frontend_event 执行广播
        broadcast_data = {
            'name': 'todo.list_updated',
            'data': {
                "action": "created",
                "todo": todo,
                "total": len(todos_db)
            },
            'timestamp': datetime.now().isoformat(),
            'metadata': {'source': 'backend'},
            'scope': 'broadcast'
        }

        print(f"📡 请求广播新 Todo: {todo['title']}")
        return {"broadcast": broadcast_data}

    return {"broadcasted": False}


@on_event("todo.completed")
def mark_todo_completed(event: Event):
    """标记 Todo 为已完成"""
    from datetime import datetime

    todo_id = event.data.get("id")

    if todo_id in todos_db:
        todos_db[todo_id]["completed"] = True

        # 返回广播请求
        broadcast_data = {
            'name': 'todo.list_updated',
            'data': {
                "action": "completed",
                "todo": todos_db[todo_id],
                "total": len(todos_db)
            },
            'timestamp': datetime.now().isoformat(),
            'metadata': {'source': 'backend'},
            'scope': 'broadcast'
        }

        print(f"✓ Todo #{todo_id} 已完成，请求广播")
        return {"broadcast": broadcast_data}

    return {"completed": False, "error": "Todo not found"}


@on_event("todo.deleted")
def delete_todo_from_db(event: Event):
    """从数据库删除 Todo"""
    from datetime import datetime

    todo_id = event.data.get("id")

    if todo_id in todos_db:
        deleted_todo = todos_db.pop(todo_id)

        # 返回广播请求
        broadcast_data = {
            'name': 'todo.list_updated',
            'data': {
                "action": "deleted",
                "todo": deleted_todo,
                "total": len(todos_db)
            },
            'timestamp': datetime.now().isoformat(),
            'metadata': {'source': 'backend'},
            'scope': 'broadcast'
        }

        print(f"🗑️  Todo #{todo_id} 已删除，请求广播")
        return {"broadcast": broadcast_data}

    return {"deleted": False, "error": "Todo not found"}


# ============= 辅助函数 =============

def get_all_todos():
    """获取所有 Todos"""
    return list(todos_db.values())


def clear_all_todos():
    """清空所有 Todos"""
    global todos_db, todo_id_counter
    todos_db = {}
    todo_id_counter = 1