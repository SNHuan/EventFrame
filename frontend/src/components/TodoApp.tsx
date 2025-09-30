import { useState, useEffect } from 'react';
import { List, Input, Button, Checkbox, Card, Space, message } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { globalEventBus } from '../core/EventBus';
import { TodoApi } from '../api/todoApi';

interface Todo {
  id: number;
  title: string;
  completed: boolean;
  created_at: string;
}

export const TodoApp = () => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);

  // 初始化：加载所有 Todos
  useEffect(() => {
    fetchTodos();

    // 监听后端广播的 Todo 更新
    const unsubscribe = globalEventBus.on('todo.list_updated', (event) => {
      console.log('📡 TodoApp 收到 Todo 更新事件:', event);
      console.log('📡 事件数据:', event.data);
      const { action, todo } = event.data;

      setTodos(prev => {
        switch (action) {
          case 'created':
            message.success(`新任务：${todo.title}`);
            return [...prev, todo];
          case 'completed':
            message.info(`任务已完成：${todo.title}`);
            return prev.map(t => t.id === todo.id ? todo : t);
          case 'deleted':
            message.warning(`任务已删除：${todo.title}`);
            return prev.filter(t => t.id !== todo.id);
          default:
            return prev;
        }
      });
    });

    return () => unsubscribe();
  }, []);

  const fetchTodos = async () => {
    try {
      const todos = await TodoApi.fetchAll();
      setTodos(todos);
    } catch (error) {
      message.error('加载失败');
    }
  };

  const handleAdd = () => {
    if (!inputValue.trim()) {
      message.warning('请输入任务内容');
      return;
    }

    setLoading(true);
    try {
      // 通过事件系统创建 Todo
      TodoApi.createTodo(inputValue);
      setInputValue('');
      // 后端处理后会广播 todo.list_updated，自动更新 UI
    } catch (error) {
      message.error('创建失败');
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = (todo: Todo) => {
    // 通过事件系统完成 Todo
    TodoApi.completeTodo(todo.id);
  };

  const handleDelete = (todo: Todo) => {
    // 通过事件系统删除 Todo
    TodoApi.deleteTodo(todo.id);
  };

  const completedCount = todos.filter(t => t.completed).length;

  return (
    <Card title="📝 待办清单">
      <Space.Compact style={{ width: '100%', marginBottom: 16 }}>
        <Input
          placeholder="输入新任务..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onPressEnter={handleAdd}
          size="large"
        />
        <Button
          type="primary"
          icon={<PlusOutlined />}
          loading={loading}
          onClick={handleAdd}
          size="large"
        >
          添加
        </Button>
      </Space.Compact>

      <div style={{ marginBottom: 16, color: '#8c8c8c' }}>
        总计: {todos.length} | 已完成: {completedCount} | 未完成: {todos.length - completedCount}
      </div>

      <List
        dataSource={todos}
        locale={{ emptyText: '暂无任务' }}
        renderItem={(todo) => (
          <List.Item
            style={{
              opacity: todo.completed ? 0.6 : 1,
            }}
            actions={[
              <Button
                danger
                icon={<DeleteOutlined />}
                onClick={() => handleDelete(todo)}
                size="small"
              >
                删除
              </Button>,
            ]}
          >
            <Checkbox
              checked={todo.completed}
              onChange={() => handleComplete(todo)}
              style={{ marginRight: 8 }}
            />
            <span
              style={{
                textDecoration: todo.completed ? 'line-through' : 'none',
                flex: 1,
              }}
            >
              {todo.title}
            </span>
          </List.Item>
        )}
      />
    </Card>
  );
};