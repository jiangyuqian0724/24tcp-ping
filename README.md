# TCP Ping Monitor - 24/7 网络监控工具

一个功能强大的TCP连接监控工具，提供实时监控、历史数据记录和美观的Web管理界面。

## 功能特性

✨ **核心功能**
- 🔄 24小时不间断TCP连接监控
- 📊 实时延迟统计和成功率分析
- 📈 可视化延迟趋势图表
- 🔔 实时WebSocket数据推送
- 💾 历史数据记录（最多1000条）
- 💿 数据持久化（自动保存到文件）
- ⚙️ 可自定义检测间隔
- 🔄 容器重启后自动恢复监控

🎨 **界面特点**
- 现代化深色主题设计
- 渐变色彩和流畅动画
- 响应式布局，支持移动端
- 实时连接状态指示
- 直观的统计数据展示

## 快速开始

### 方法1: 使用 Docker (推荐)

```bash
# 使用 Docker Compose
docker-compose up -d

# 或使用 Docker 命令
docker build -t tcp-ping-monitor .
docker run -d -p 3000:3000 --name tcp-ping-monitor tcp-ping-monitor
```

服务将在 `http://localhost:3000` 启动

📖 详细的Docker部署指南请查看 [DOCKER.md](DOCKER.md)

### 方法2: 直接运行

#### 安装依赖

```bash
npm install
```

#### 启动服务

```bash
npm start
# 或使用自动端口检测
./start.sh
```

服务将在 `http://localhost:3000` 启动

### 使用方法

1. **添加监控目标**
   - 在顶部表单中输入主机地址（域名或IP）
   - 输入端口号（1-65535）
   - 设置检测间隔（秒）
   - 点击"添加监控"按钮

2. **查看监控数据**
   - 实时延迟显示
   - 成功率统计
   - 平均延迟
   - 总检测次数
   - 延迟趋势图表

3. **管理监控**
   - 点击暂停/播放按钮控制监控
   - 点击删除按钮移除监控

## API 接口

### 获取所有监控
```
GET /api/monitors
```

### 获取单个监控
```
GET /api/monitors/:id
```

### 获取监控历史
```
GET /api/monitors/:id/history?limit=100
```

### 创建监控
```
POST /api/monitors
Content-Type: application/json

{
  "host": "google.com",
  "port": 80,
  "interval": 5000
}
```

### 删除监控
```
DELETE /api/monitors/:id
```

### 启动/停止监控
```
POST /api/monitors/:id/start
POST /api/monitors/:id/stop
```

## 技术栈

- **后端**: Node.js + Express
- **WebSocket**: ws
- **前端**: 原生 HTML/CSS/JavaScript
- **图表**: Canvas API

## 配置

### 环境变量

- `PORT`: 服务端口（默认: 3000）

### 数据持久化

所有监控配置和历史数据自动保存到 `data/` 目录：
- `data/monitors.json`: 监控配置和统计信息
- `data/history.json`: ping历史记录

📖 详细说明请查看 [DATA_PERSISTENCE.md](DATA_PERSISTENCE.md)

### 常量配置

在 `server.js` 中可以修改：

- `MAX_HISTORY`: 历史记录最大条数（默认: 1000）
- TCP连接超时时间（默认: 5000ms）

## 监控示例

### 常用服务端口

- HTTP: 80
- HTTPS: 443
- SSH: 22
- MySQL: 3306
- PostgreSQL: 5432
- Redis: 6379
- MongoDB: 27017

### 示例监控配置

```javascript
// Google DNS
Host: 8.8.8.8
Port: 53
Interval: 5

// 本地Web服务
Host: localhost
Port: 80
Interval: 10

// 远程数据库
Host: db.example.com
Port: 3306
Interval: 30
```

## 数据说明

### 统计指标

- **延迟**: 当前TCP连接响应时间（毫秒）
- **成功率**: 成功连接次数 / 总检测次数
- **平均延迟**: 所有成功连接的平均响应时间
- **总检测**: 累计检测次数
- **运行时间**: 成功连接次数占比

### 状态说明

- 🟢 **在线**: TCP连接成功
- 🔴 **离线**: TCP连接失败或超时
- ⚪ **未知**: 尚未开始检测

## 注意事项

1. **防火墙**: 确保目标端口未被防火墙阻止
2. **权限**: 某些端口可能需要管理员权限
3. **性能**: 监控过多目标可能影响性能
4. **超时**: 默认5秒超时，长延迟连接会显示为失败

## 故障排查

### WebSocket连接失败
- 检查浏览器控制台错误信息
- 确认服务器正常运行
- 检查防火墙和代理设置

### 监控显示离线
- 验证目标主机和端口是否正确
- 检查网络连接
- 确认目标服务是否运行

### 图表不显示
- 刷新页面
- 检查浏览器控制台错误
- 确认Canvas支持

## 许可证

MIT License

## 作者

Created with ❤️ by Antigravity AI
