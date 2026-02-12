#!/bin/bash

# TCP Ping Monitor 启动脚本

echo "🚀 启动 TCP Ping Monitor..."

# 检查 node_modules 是否存在
if [ ! -d "node_modules" ]; then
    echo "📦 安装依赖..."
    npm install
fi

# 查找可用端口
PORT=3000
while lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1 ; do
    echo "⚠️  端口 $PORT 已被占用，尝试下一个端口..."
    PORT=$((PORT + 1))
done

echo "✅ 使用端口: $PORT"
echo "🌐 访问地址: http://localhost:$PORT"
echo ""

# 启动服务
PORT=$PORT npm start
