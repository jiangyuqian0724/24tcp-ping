# 数据持久化说明

## 📁 数据存储位置

所有ping监控数据保存在 `data/` 目录下：

```
tcp-ping-monitor/
└── data/
    ├── monitors.json    # 监控配置和统计数据
    └── history.json     # ping历史记录
```

## 💾 数据文件说明

### monitors.json

存储所有监控目标的配置和统计信息：

```json
[
  {
    "id": "8.8.8.8:53",
    "host": "8.8.8.8",
    "port": 53,
    "interval": 5000,
    "stats": {
      "totalPings": 100,
      "successfulPings": 98,
      "failedPings": 2,
      "averageLatency": 5,
      "lastStatus": "online",
      "lastLatency": 3,
      "lastCheck": 1770894206245,
      "uptime": 98,
      "downtime": 2
    }
  }
]
```

### history.json

存储每个监控目标的ping历史记录（最多1000条）：

```json
{
  "8.8.8.8:53": [
    {
      "timestamp": 1770894206245,
      "success": true,
      "latency": 3,
      "error": null
    },
    {
      "timestamp": 1770894211245,
      "success": true,
      "latency": 2,
      "error": null
    }
  ]
}
```

## 🔄 自动保存机制

### 1. 定时自动保存
- **频率**: 每60秒自动保存一次
- **内容**: 保存所有监控配置和历史数据

### 2. 操作触发保存
以下操作会立即触发数据保存：
- ✅ 添加新监控
- ✅ 删除监控
- ✅ 启动/停止监控

### 3. 优雅关闭保存
当服务收到关闭信号时（SIGINT/SIGTERM），会先保存数据再退出

## 🚀 启动时自动加载

服务启动时会自动：
1. 检查 `data/` 目录是否存在
2. 如果不存在则创建
3. 加载 `monitors.json` 中的所有监控
4. 自动启动所有已保存的监控
5. 加载 `history.json` 中的历史记录

## 🐳 Docker 数据持久化

### Docker Compose 配置

```yaml
services:
  tcp-ping-monitor:
    volumes:
      - ./data:/app/data  # 挂载本地data目录到容器
```

### 数据位置

- **宿主机**: `/root/.gemini/antigravity/scratch/tcp-ping-monitor/data/`
- **容器内**: `/app/data/`

### 重启容器后数据保留

```bash
# 停止容器
docker compose down

# 数据仍然保存在宿主机的 data/ 目录

# 重新启动
docker compose up -d

# 所有监控自动恢复
```

## 📊 数据查看

### 查看监控配置

```bash
cat data/monitors.json | jq '.'
```

### 查看历史记录

```bash
cat data/history.json | jq '.'
```

### 查看特定监控的历史

```bash
cat data/history.json | jq '."8.8.8.8:53"'
```

## 🔧 数据管理

### 备份数据

```bash
# 备份整个data目录
tar -czf data-backup-$(date +%Y%m%d).tar.gz data/

# 或只备份JSON文件
cp data/monitors.json monitors-backup.json
cp data/history.json history-backup.json
```

### 恢复数据

```bash
# 停止服务
docker compose down

# 恢复数据文件
cp monitors-backup.json data/monitors.json
cp history-backup.json data/history.json

# 重启服务
docker compose up -d
```

### 清空数据

```bash
# 停止服务
docker compose down

# 删除数据文件
rm -rf data/*

# 重启服务（将创建空的数据文件）
docker compose up -d
```

## 📝 数据导出

### 导出为CSV

可以使用 `jq` 将JSON转换为CSV：

```bash
# 导出监控列表
cat data/monitors.json | jq -r '.[] | [.id, .host, .port, .stats.totalPings, .stats.successfulPings, .stats.averageLatency] | @csv' > monitors.csv

# 导出历史记录
cat data/history.json | jq -r 'to_entries[] | .key as $id | .value[] | [$id, .timestamp, .success, .latency] | @csv' > history.csv
```

## 🔍 故障排查

### 数据文件损坏

如果JSON文件损坏，服务会记录错误但继续运行：

```bash
# 查看日志
docker compose logs

# 如果看到 "Error loading data" 错误
# 1. 停止服务
docker compose down

# 2. 检查JSON格式
cat data/monitors.json | jq '.'

# 3. 如果格式错误，删除或修复文件
rm data/monitors.json  # 或手动修复

# 4. 重启服务
docker compose up -d
```

### 数据目录权限问题

```bash
# 确保data目录有正确的权限
chmod 755 data/
chmod 644 data/*.json
```

### 容器无法写入数据

```bash
# 检查卷挂载
docker compose config

# 检查容器内的权限
docker compose exec tcp-ping-monitor ls -la /app/data
```

## 📈 数据增长

### 存储空间估算

- **monitors.json**: 约300-500字节/监控
- **history.json**: 约100字节/记录

示例：
- 10个监控 × 1000条历史 = 约1MB
- 100个监控 × 1000条历史 = 约10MB

### 历史记录限制

- 每个监控最多保存 **1000条** 历史记录
- 超过限制时自动删除最旧的记录
- 可在 `server.js` 中修改 `MAX_HISTORY` 常量

## 🔐 安全建议

1. **定期备份**: 建议每天备份数据文件
2. **权限控制**: 确保data目录只有必要的访问权限
3. **敏感信息**: 不要在监控配置中包含敏感信息
4. **加密**: 如需加密，可以在备份时加密整个data目录

## 💡 最佳实践

1. **定期备份**: 设置cron任务自动备份
   ```bash
   # 每天凌晨2点备份
   0 2 * * * cd /root/.gemini/antigravity/scratch/tcp-ping-monitor && tar -czf backup/data-$(date +\%Y\%m\%d).tar.gz data/
   ```

2. **监控数据大小**: 定期检查data目录大小
   ```bash
   du -sh data/
   ```

3. **清理旧备份**: 只保留最近30天的备份
   ```bash
   find backup/ -name "data-*.tar.gz" -mtime +30 -delete
   ```

4. **版本控制**: 不要将data目录提交到Git
   ```bash
   # .gitignore 已包含
   data/
   ```

## 📚 相关API

### 获取历史数据

```bash
# 获取最近100条记录
curl http://localhost:8080/api/monitors/8.8.8.8:53/history?limit=100

# 获取所有监控
curl http://localhost:8080/api/monitors
```

### 手动触发保存

虽然系统会自动保存，但你可以通过以下操作触发立即保存：

```bash
# 停止并重新启动任何监控
curl -X POST http://localhost:8080/api/monitors/8.8.8.8:53/stop
curl -X POST http://localhost:8080/api/monitors/8.8.8.8:53/start
```

## 🎯 总结

- ✅ 数据自动保存到 `data/` 目录
- ✅ 每60秒自动保存一次
- ✅ 重要操作立即保存
- ✅ 容器重启后数据保留
- ✅ 支持备份和恢复
- ✅ JSON格式易于查看和编辑
