"""
配置加载器 - 从 YAML 文件加载配置
"""

import yaml
from pathlib import Path
from typing import Any, Dict


class Config:
    """配置类 - 支持点号访问"""

    def __init__(self, data: Dict[str, Any]):
        self._data = data

    def __getattr__(self, name: str) -> Any:
        if name.startswith('_'):
            return object.__getattribute__(self, name)

        value = self._data.get(name)
        if isinstance(value, dict):
            return Config(value)
        return value

    def get(self, key: str, default: Any = None) -> Any:
        """获取配置值，支持默认值"""
        return self._data.get(key, default)

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return self._data


def load_config(config_path: str = 'config.yaml') -> Config:
    """
    加载配置文件

    Args:
        config_path: 配置文件路径，相对于项目根目录

    Returns:
        Config 对象
    """
    # 获取项目根目录
    root_dir = Path(__file__).parent.parent
    config_file = root_dir / config_path

    if not config_file.exists():
        raise FileNotFoundError(f"配置文件不存在: {config_file}")

    with open(config_file, 'r', encoding='utf-8') as f:
        data = yaml.safe_load(f)

    return Config(data)


# 全局配置实例
config = load_config()