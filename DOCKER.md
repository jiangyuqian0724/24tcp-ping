# Docker 部署指南

## 快速开始

### 方法1: 使用 Docker Compose (推荐)

```bash
# 构建并启动
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

访问: http://localhost:3000

### 方法2: 使用 Docker 命令

```bash
# 构建镜像
docker build -t tcp-ping-monitor .

# 运行容器
docker run -d \
  --name tcp-ping-monitor \
  -p 3000:3000 \
  --restart unless-stopped \
  tcp-ping-monitor

# 查看日志
docker logs -f tcp-ping-monitor

# 停止容器
docker stop tcp-ping-monitor

# 删除容器
docker rm tcp-ping-monitor
```

## 自定义端口

### Docker Compose

编辑 `docker-compose.yml`:

```yaml
ports:
  - "8080:3000"  # 主机端口:容器端口
```

### Docker 命令

```bash
docker run -d \
  --name tcp-ping-monitor \
  -p 8080:3000 \
  tcp-ping-monitor
```

访问: http://localhost:8080

## 环境变量

```bash
docker run -d \
  --name tcp-ping-monitor \
  -p 3000:3000 \
  -e PORT=3000 \
  -e NODE_ENV=production \
  tcp-ping-monitor
```

## 数据持久化

如果未来添加数据库支持，可以挂载卷：

```bash
docker run -d \
  --name tcp-ping-monitor \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  tcp-ping-monitor
```

或在 `docker-compose.yml` 中：

```yaml
services:
  tcp-ping-monitor:
    volumes:
      - ./data:/app/data
```

## 健康检查

容器包含健康检查，自动监控服务状态：

```bash
# 查看健康状态
docker inspect --format='{{.State.Health.Status}}' tcp-ping-monitor

# 查看健康检查日志
docker inspect --format='{{json .State.Health}}' tcp-ping-monitor | jq
```

## 网络配置

### 连接到其他容器

```yaml
version: '3.8'

services:
  tcp-ping-monitor:
    build: .
    ports:
      - "3000:3000"
    networks:
      - app-network

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    networks:
      - app-network

networks:
  app-network:
    driver: bridge
```

### 监控其他 Docker 容器

```bash
# 获取容器 IP
docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' container_name

# 在监控界面添加
# 主机: 172.17.0.2 (容器IP)
# 端口: 服务端口
```

## 生产环境部署

### 使用 Nginx 反向代理

`nginx.conf`:

```nginx
upstream tcp_monitor {
    server tcp-ping-monitor:3000;
}

server {
    listen 80;
    server_name monitor.example.com;

    location / {
        proxy_pass http://tcp_monitor;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

`docker-compose.yml`:

```yaml
version: '3.8'

services:
  tcp-ping-monitor:
    build: .
    expose:
      - "3000"
    networks:
      - monitor-network
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - tcp-ping-monitor
    networks:
      - monitor-network
    restart: unless-stopped

networks:
  monitor-network:
    driver: bridge
```

### 启用 HTTPS

```bash
# 生成自签名证书（测试用）
mkdir ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout ssl/nginx.key -out ssl/nginx.crt
```

更新 `nginx.conf`:

```nginx
server {
    listen 443 ssl;
    server_name monitor.example.com;

    ssl_certificate /etc/nginx/ssl/nginx.crt;
    ssl_certificate_key /etc/nginx/ssl/nginx.key;

    location / {
        proxy_pass http://tcp_monitor;
        # ... 其他配置
    }
}
```

## 资源限制

限制容器资源使用：

```yaml
services:
  tcp-ping-monitor:
    build: .
    ports:
      - "3000:3000"
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 256M
```

或使用 Docker 命令：

```bash
docker run -d \
  --name tcp-ping-monitor \
  -p 3000:3000 \
  --memory="512m" \
  --cpus="0.5" \
  tcp-ping-monitor
```

## 日志管理

### 限制日志大小

```yaml
services:
  tcp-ping-monitor:
    build: .
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

### 查看日志

```bash
# 实时日志
docker-compose logs -f

# 最近100行
docker-compose logs --tail=100

# 特定时间
docker-compose logs --since 30m
```

## 更新和维护

### 更新应用

```bash
# 停止并删除旧容器
docker-compose down

# 重新构建
docker-compose build --no-cache

# 启动新容器
docker-compose up -d
```

### 备份

```bash
# 导出容器配置
docker inspect tcp-ping-monitor > backup-config.json

# 如果有数据卷
docker run --rm \
  -v tcp-ping-monitor_data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/data-backup.tar.gz /data
```

## 故障排查

### 容器无法启动

```bash
# 查看详细日志
docker logs tcp-ping-monitor

# 检查容器状态
docker ps -a

# 进入容器调试
docker exec -it tcp-ping-monitor sh
```

### 端口冲突

```bash
# 查看端口占用
netstat -tulpn | grep 3000

# 使用其他端口
docker run -p 8080:3000 tcp-ping-monitor
```

### 网络问题

```bash
# 检查网络
docker network ls
docker network inspect monitor-network

# 测试连接
docker exec tcp-ping-monitor ping google.com
```

## 性能优化

### 多阶段构建

优化后的 `Dockerfile`:

```dockerfile
# 构建阶段
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# 运行阶段
FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY server.js ./
COPY public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

### 使用 .dockerignore

确保 `.dockerignore` 排除不必要的文件，减小镜像大小。

## 监控和告警

### 集成 Prometheus

添加健康检查端点，然后配置 Prometheus 抓取。

### 集成 Grafana

使用 Grafana 可视化监控数据。

## 安全建议

1. **不要以 root 运行**

```dockerfile
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001
USER nodejs
```

2. **扫描漏洞**

```bash
docker scan tcp-ping-monitor
```

3. **使用最小化镜像**

已使用 `alpine` 基础镜像，体积小且安全。

4. **定期更新**

```bash
docker pull node:18-alpine
docker-compose build --no-cache
```

## 常用命令速查

```bash
# 构建
docker-compose build

# 启动
docker-compose up -d

# 停止
docker-compose down

# 重启
docker-compose restart

# 查看状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 进入容器
docker-compose exec tcp-ping-monitor sh

# 清理
docker system prune -a
```
