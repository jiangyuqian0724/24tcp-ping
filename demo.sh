#!/bin/bash

# TCP Ping Monitor 演示脚本
# 自动添加几个常用的监控目标进行演示

API="http://localhost:8080/api/monitors"

echo "🎯 TCP Ping Monitor 演示"
echo "================================"
echo ""

# 检查服务是否运行
echo "📡 检查服务状态..."
if ! curl -s "$API" > /dev/null 2>&1; then
    echo "❌ 服务未运行！请先启动服务："
    echo "   npm start"
    echo "   或"
    echo "   ./start.sh"
    exit 1
fi
echo "✅ 服务正在运行"
echo ""

# 添加监控目标
echo "➕ 添加监控目标..."
echo ""

# 1. Google DNS
echo "1️⃣  添加 Google DNS (8.8.8.8:53)"
curl -s -X POST "$API" \
  -H "Content-Type: application/json" \
  -d '{"host":"8.8.8.8","port":53,"interval":5000}' | jq '.' 2>/dev/null || echo "已添加"
echo ""

# 2. Cloudflare DNS
echo "2️⃣  添加 Cloudflare DNS (1.1.1.1:53)"
curl -s -X POST "$API" \
  -H "Content-Type: application/json" \
  -d '{"host":"1.1.1.1","port":53,"interval":5000}' | jq '.' 2>/dev/null || echo "已添加"
echo ""

# 3. Google HTTPS
echo "3️⃣  添加 Google HTTPS (google.com:443)"
curl -s -X POST "$API" \
  -H "Content-Type: application/json" \
  -d '{"host":"google.com","port":443,"interval":10000}' | jq '.' 2>/dev/null || echo "已添加"
echo ""

# 4. Cloudflare HTTPS
echo "4️⃣  添加 Cloudflare HTTPS (cloudflare.com:443)"
curl -s -X POST "$API" \
  -H "Content-Type: application/json" \
  -d '{"host":"cloudflare.com","port":443,"interval":10000}' | jq '.' 2>/dev/null || echo "已添加"
echo ""

echo "================================"
echo "✅ 演示监控已添加完成！"
echo ""
echo "📊 等待10秒收集数据..."
sleep 10
echo ""

echo "📈 当前监控状态："
echo "================================"
curl -s "$API" | jq '.' 2>/dev/null || curl -s "$API"
echo ""

echo "================================"
echo "🌐 请在浏览器中访问："
echo "   http://localhost:8080"
echo ""
echo "💡 提示："
echo "   - 刷新页面查看实时更新"
echo "   - 点击暂停/播放按钮控制监控"
echo "   - 点击删除按钮移除监控"
echo "   - 查看延迟趋势图表"
echo ""
echo "🛑 停止演示："
echo "   按 Ctrl+C 停止服务"
echo "================================"
