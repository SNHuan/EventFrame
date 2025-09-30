/**
 * Todo API - 通过事件系统交互
 */

import { globalEventBus } from '../core/EventBus';

interface Todo {
  id: number;
  title: string;
  completed: boolean;
  created_at: string;
}

export class TodoApi {
  /**
   * 获取所有 Todos（初始化时从后端加载）
   */
  static async fetchAll(): Promise<Todo[]> {
    const response = await fetch('http://localhost:5000/api/todos');
    const data = await response.json();
    return data.todos;
  }

  /**
   * 创建 Todo - 通过事件系统
   */
  static createTodo(title: string): void {
    globalEventBus.emit('todo.created', { title });
  }

  /**
   * 完成 Todo - 通过事件系统
   */
  static completeTodo(id: number): void {
    globalEventBus.emit('todo.completed', { id });
  }

  /**
   * 删除 Todo - 通过事件系统
   */
  static deleteTodo(id: number): void {
    globalEventBus.emit('todo.deleted', { id });
  }
}