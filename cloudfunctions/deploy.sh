#!/usr/bin/env bash
# 灵动打卡 H5 · CloudBase 云函数一键部署
# 用法：进入 cloudfunctions/ 目录后执行  bash deploy.sh
# 前置：npm i -g @cloudbase/cli  &&  tcb login（首次会弹浏览器扫码你的腾讯云账号）

set -e

ENV_ID="richieshao-1980-d9f5588r8f7850a1"
DIR="$(cd "$(dirname "$0")" && pwd)"

echo "==> 目标环境: $ENV_ID"

# 1) 创建 sync 集合（已存在则忽略报错）
echo "==> 创建数据库集合 sync"
tcb db create-collection sync --envId "$ENV_ID" || echo "（sync 集合已存在，忽略）"

# 2) 逐个部署三个云函数（每个目录自带 package.json，云端自动装依赖）
for fn in getUnionid pull push; do
  echo "==> 部署云函数: $fn"
  ( cd "$DIR/$fn" && tcb fn deploy "$fn" --envId "$ENV_ID" )
done

# 3) 列出已部署函数做验证（命令名若不同版本有差异，失败也不影响已部署结果）
echo "==> 已部署函数列表"
tcb fn list --envId "$ENV_ID" || echo "（列出函数命令不可用，可去控制台确认）"

echo ""
echo "✔ 部署完成！"
echo "   还需到 CloudBase 控制台 → 环境 → 安全配置 → Web 安全域名，把以下域名之一加上："
echo "     · GitHub Pages: richieshao.github.io"
echo "     · CloudBase 静态托管: richieshao-1980-d9f5588r8f7850a1-1450128794.ap-shanghai.app.tcloudbase.com"
