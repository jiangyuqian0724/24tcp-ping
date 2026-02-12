# 项目结构

```
tcp-ping-monitor/
├── server.js              # Node.js 后端服务器
├── package.json           # 项目依赖配置
├── package-lock.json      # 依赖锁定文件
├── start.sh              # 快速启动脚本
├── .gitignore            # Git 忽略文件
├── README.md             # 项目说明文档
├── EXAMPLES.md           # 使用示例文档
└── public/               # 前端静态文件
    ├── index.html        # 主页面
    ├── style.css         # 样式文件
    └── app.js            # 前端 JavaScript

## 文件说明

### 后端文件

**server.js** (6.6KB)
- Express HTTP 服务器
- WebSocket 服务器（实时数据推送）
- TCP ping 监控核心逻辑
- REST API 接口
- 数据存储和管理

主要类和功能：
- `TCPMonitor` 类：封装单个监控目标的所有逻辑
- `ping()` 方法：执行 TCP 连接测试
- `start()` / `stop()` 方法：控制监控状态
- WebSocket 广播：实时推送更新到所有客户端
- REST API 路由：CRUD 操作

### 前端文件

**index.html** (4.5KB)
- 响应式页面布局
- 监控卡片模板
- 表单和统计面板
- SVG 图标

**style.css** (12KB)
- 现代深色主题
- 渐变色彩系统
- 流畅动画效果
- 响应式设计
- 自定义组件样式

**app.js** (10KB)
- WebSocket 客户端连接
- 实时数据更新
- 图表绘制（Canvas）
- API 调用封装
- 用户交互处理

### 配置文件

**package.json**
```json
{
  "dependencies": {
    "express": "^4.18.2",  // HTTP 服务器
    "ws": "^8.14.2"        // WebSocket 服务器
  }
}
```

**start.sh**
- 自动检测可用端口
- 安装依赖（如需要）
- 启动服务器

## 核心功能模块

### 1. TCP Ping 引擎

位置：`server.js` - `TCPMonitor` 类

功能：
- 使用原生 `net.Socket` 进行 TCP 连接测试
- 5秒超时机制
- 延迟计算（毫秒级）
- 错误处理和重试

### 2. 数据存储

位置：`server.js` - 全局变量

结构：
```javascript
monitors = Map<id, TCPMonitor>     // 监控实例
pingHistory = Map<id, Array>       // 历史记录（最多1000条）
```

### 3. WebSocket 实时推送

位置：`server.js` - WebSocket 服务器

消息类型：
- `init`: 初始化所有监控数据
- `update`: 单个监控更新

### 4. REST API

端点：
- `GET /api/monitors` - 获取所有监控
- `GET /api/monitors/:id` - 获取单个监控
- `GET /api/monitors/:id/history` - 获取历史记录
- `POST /api/monitors` - 创建监控
- `DELETE /api/monitors/:id` - 删除监控
- `POST /api/monitors/:id/start` - 启动监控
- `POST /api/monitors/:id/stop` - 停止监控

### 5. 前端图表系统

位置：`public/app.js` - `updateChart()` 函数

特性：
- Canvas 绘制
- 最多显示50个数据点
- 自动缩放
- 成功/失败状态颜色区分
- 网格线背景

### 6. 实时更新机制

流程：
1. 后端执行 TCP ping
2. 更新内存中的数据
3. 通过 WebSocket 广播到所有客户端
4. 前端接收并更新 UI
5. 重新绘制图表

## 数据流

```
[用户添加监控]
    ↓
[POST /api/monitors]
    ↓
[创建 TCPMonitor 实例]
    ↓
[启动定时 ping]
    ↓
[每次 ping 结果]
    ↓
[更新统计数据]
    ↓
[存入历史记录]
    ↓
[WebSocket 广播]
    ↓
[前端更新 UI + 图表]
```

## 性能考虑

### 内存管理
- 历史记录限制：每个监控最多1000条
- 图表数据：每个监控最多50个点
- 自动清理：删除监控时清理所有相关数据

### 并发处理
- 每个监控独立运行
- 异步 TCP 连接
- 非阻塞 I/O

### 网络优化
- WebSocket 复用单一连接
- 增量数据更新
- 客户端自动重连

## 扩展建议

### 可添加的功能

1. **数据持久化**
   - 使用 SQLite/MongoDB 存储历史数据
   - 支持数据导出（CSV/JSON）

2. **告警系统**
   - 邮件/短信通知
   - Webhook 集成
   - 告警规则配置

3. **用户认证**
   - JWT 认证
   - 多用户支持
   - 权限管理

4. **高级图表**
   - 使用 Chart.js 或 ECharts
   - 更多统计维度
   - 时间范围选择

5. **监控组**
   - 分组管理
   - 批量操作
   - 标签系统

6. **性能优化**
   - Redis 缓存
   - 数据库索引
   - CDN 加速

## 技术栈详解

### 后端
- **Node.js**: JavaScript 运行时
- **Express**: Web 框架
- **ws**: WebSocket 库
- **net**: Node.js 原生 TCP 模块

### 前端
- **原生 JavaScript**: 无框架依赖
- **Canvas API**: 图表绘制
- **WebSocket API**: 实时通信
- **Fetch API**: HTTP 请求

### 样式
- **CSS3**: 现代特性
- **CSS Grid**: 响应式布局
- **CSS Animations**: 流畅动画
- **CSS Variables**: 主题系统

## 浏览器兼容性

支持的浏览器：
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Opera 76+

需要的特性：
- WebSocket
- Canvas
- Fetch API
- CSS Grid
- CSS Variables

## 部署建议

### 开发环境
```bash
npm install
npm start
```

### 生产环境
```bash
# 使用 PM2
npm install -g pm2
pm2 start server.js --name tcp-monitor

# 使用 Docker
docker build -t tcp-monitor .
docker run -p 8080:3000 tcp-monitor

# 使用 systemd
sudo systemctl enable tcp-monitor
sudo systemctl start tcp-monitor
```

### 反向代理（Nginx）
```nginx
server {
    listen 80;
    server_name monitor.example.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

## 维护建议

1. **定期更新依赖**
   ```bash
   npm update
   npm audit fix
   ```

2. **监控服务状态**
   - 使用 PM2 监控
   - 日志收集
   - 性能分析

3. **备份数据**
   - 定期导出监控配置
   - 备份历史数据

4. **安全加固**
   - 限制访问 IP
   - 启用 HTTPS
   - 添加认证
