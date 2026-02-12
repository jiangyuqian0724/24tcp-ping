# 使用示例

## 快速测试

以下是一些可以立即测试的常用服务：

### 1. 测试 Google DNS
- **主机**: 8.8.8.8
- **端口**: 53
- **间隔**: 5秒

### 2. 测试 Cloudflare DNS
- **主机**: 1.1.1.1
- **端口**: 53
- **间隔**: 5秒

### 3. 测试 Google HTTPS
- **主机**: google.com
- **端口**: 443
- **间隔**: 10秒

### 4. 测试本地服务
- **主机**: localhost
- **端口**: 8080
- **间隔**: 3秒

## 监控场景示例

### 场景1: 网站可用性监控

监控你的网站是否在线：

```
主机: example.com
端口: 443 (HTTPS) 或 80 (HTTP)
间隔: 30秒
```

### 场景2: 数据库连接监控

监控数据库服务器连接：

```
MySQL:
主机: db.example.com
端口: 3306
间隔: 60秒

PostgreSQL:
主机: db.example.com
端口: 5432
间隔: 60秒

Redis:
主机: cache.example.com
端口: 6379
间隔: 30秒
```

### 场景3: API服务监控

监控API服务的可用性：

```
主机: api.example.com
端口: 443
间隔: 15秒
```

### 场景4: 内网服务监控

监控内网服务器：

```
主机: 192.168.1.100
端口: 22 (SSH)
间隔: 30秒
```

## 常用端口参考

| 服务 | 端口 | 说明 |
|------|------|------|
| HTTP | 80 | 网页服务 |
| HTTPS | 443 | 加密网页服务 |
| SSH | 22 | 远程登录 |
| FTP | 21 | 文件传输 |
| SMTP | 25 | 邮件发送 |
| POP3 | 110 | 邮件接收 |
| IMAP | 143 | 邮件接收 |
| DNS | 53 | 域名解析 |
| MySQL | 3306 | MySQL数据库 |
| PostgreSQL | 5432 | PostgreSQL数据库 |
| MongoDB | 27017 | MongoDB数据库 |
| Redis | 6379 | Redis缓存 |
| Elasticsearch | 9200 | 搜索引擎 |
| RabbitMQ | 5672 | 消息队列 |

## 最佳实践

### 1. 合理设置检测间隔

- **关键服务**: 5-10秒
- **一般服务**: 30-60秒
- **低优先级**: 5分钟以上

### 2. 避免过度监控

不要同时监控太多目标（建议不超过20个），以免影响性能。

### 3. 注意网络限制

某些服务可能有频率限制，避免设置过短的检测间隔。

### 4. 使用有意义的命名

虽然系统自动使用 `host:port` 作为ID，但你可以通过主机名来区分不同的服务。

## 故障诊断

### 监控显示离线但服务正常

可能原因：
1. 防火墙阻止了连接
2. 服务器禁止了你的IP
3. 网络延迟导致超时（默认5秒）
4. 端口号错误

解决方法：
1. 检查防火墙设置
2. 验证端口是否正确
3. 尝试增加检测间隔
4. 使用其他工具验证（如telnet）

### 延迟异常高

可能原因：
1. 网络拥堵
2. 服务器负载高
3. 地理位置远

解决方法：
1. 检查网络状况
2. 监控服务器性能
3. 考虑使用CDN或就近服务器

## 进阶用法

### 通过API批量添加监控

```bash
# 添加多个监控目标
curl -X POST http://localhost:8080/api/monitors \
  -H "Content-Type: application/json" \
  -d '{"host":"google.com","port":443,"interval":5000}'

curl -X POST http://localhost:8080/api/monitors \
  -H "Content-Type: application/json" \
  -d '{"host":"8.8.8.8","port":53,"interval":5000}'
```

### 获取监控数据

```bash
# 获取所有监控
curl http://localhost:8080/api/monitors

# 获取特定监控的历史数据
curl http://localhost:8080/api/monitors/google.com:443/history?limit=100
```

### 自动化脚本

```bash
#!/bin/bash
# 自动添加常用服务监控

API="http://localhost:8080/api/monitors"

# 添加DNS监控
curl -X POST $API -H "Content-Type: application/json" \
  -d '{"host":"8.8.8.8","port":53,"interval":5000}'

# 添加网站监控
curl -X POST $API -H "Content-Type: application/json" \
  -d '{"host":"google.com","port":443,"interval":10000}'

echo "监控已添加完成！"
```

## 性能优化建议

1. **合理的检测间隔**: 根据服务重要性设置不同的间隔
2. **限制历史数据**: 系统默认保留1000条历史记录
3. **及时清理**: 删除不再需要的监控项
4. **分散检测时间**: 避免所有监控同时检测

## 安全建议

1. **不要暴露在公网**: 建议只在内网使用
2. **使用反向代理**: 如需公网访问，使用Nginx等反向代理并配置认证
3. **限制访问IP**: 通过防火墙限制访问来源
4. **定期更新**: 保持依赖包更新以修复安全漏洞
