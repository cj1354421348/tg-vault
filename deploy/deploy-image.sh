#!/usr/bin/env bash
# 用 GitHub Actions 已构建好的镜像部署 TG Vault：服务器不编译，也不需要域名。
#
# 在项目根目录执行（先 git pull 拿到本脚本和新版 install.sh）：
#   ./deploy/deploy-image.sh http://192.168.1.10:47832      # HTTP + IP:端口
#   ./deploy/deploy-image.sh https://cloud.example.com      # HTTPS + 域名
#
# 参数：
#   $1  Web 访问地址，必须是完整的 http(s) origin（就是浏览器地址栏里输入的那个）。
#
# 可选环境变量：
#   IMAGE_REPOSITORY  镜像仓库前缀，如 ghcr.io/yourname（默认从 git remote 推导）
#   IMAGE_TAG         镜像标签。默认：HEAD 正好在 v* 发布标签上时用该标签，否则用 latest
#                     （CI 只在推 git 标签时才会生成 v<版本> 这种标签，普通 main 推送没有）。
#   WEB_BIND          前端在宿主机上的监听地址。默认 127.0.0.1（配合宿主 Nginx）；
#                     仅用 http://IP:端口 直连时设为 0.0.0.0（记得放通防火墙）。
#   WEB_PORT          前端在宿主机上的端口，默认 47832。
#   INSTALL_HEALTH_TIMEOUT  等待容器健康的秒数（30-1800），默认 180。
set -Eeuo pipefail

cd "$(dirname "$0")/.."

usage() {
  cat <<'EOF'
用法：./deploy/deploy-image.sh <Web 访问地址>

  例：./deploy/deploy-image.sh http://192.168.1.10:47832
      ./deploy/deploy-image.sh https://cloud.example.com

地址必须是完整的 http(s) origin（协议 + 主机 + 可选端口），不能带路径。
镜像仓库默认从 git remote 推导，可用 IMAGE_REPOSITORY / IMAGE_TAG 覆盖。
用 http://IP:端口 直连时额外加：WEB_BIND=0.0.0.0 ./deploy/deploy-image.sh ...
EOF
  exit 2
}

web_origin="${1:-}"
[[ -n "$web_origin" && "$web_origin" != -* ]] || usage

[[ -f docker-compose.yml && -f deploy/install.sh ]] || usage
command -v docker >/dev/null 2>&1 || { echo "未找到 docker。" >&2; exit 2; }
docker compose version >/dev/null 2>&1 || { echo "未找到 docker compose v2。" >&2; exit 2; }

# 老版本 install.sh 会把 --image 当未知参数忽略，然后在服务器上本地编译（正是我们要避免的）。
grep -q -- '--image' deploy/install.sh || { echo "deploy/install.sh 版本过旧，不支持 --image：请先执行 git pull。" >&2; exit 2; }

[[ -f .env ]] || { echo "缺少 .env：请先执行一次 ./deploy/install.sh 完成初始安装（本脚本只做升级/切换部署方式）。" >&2; exit 2; }

# 交给 install-config.py 校验并归一化。CORS_ORIGIN 不是精确 origin 会让浏览器的
# 同源校验把登录等所有 POST 请求 403，所以这里不能自己拼字符串。
web_origin="$(python3 deploy/install-config.py origin "$web_origin")"

if [[ "$web_origin" == https://* ]]; then
  echo "Web 地址：$web_origin（HTTPS，会话 Cookie 保持 Secure）"
else
  echo "Web 地址：$web_origin（HTTP，install.sh 会自动关闭 Secure Cookie，否则登录成功后会立刻跳回登录页）"
fi

# .env 是唯一事实来源：非交互模式会忽略环境变量里的 URL 覆盖，所以必须先落盘。
python3 deploy/install-config.py upsert CORS_ORIGIN "$web_origin" .env
# 留空 = 与 Web 同域：前端容器内的 Nginx 把 /api 转发给后端，
# 天然满足 CSP connect-src 'self' 与 SameSite=Lax，不需要额外证书和 CORS 配置。
python3 deploy/install-config.py upsert VITE_API_URL "" .env
if [[ -n "${WEB_BIND:-}" || -n "${WEB_PORT:-}" ]]; then
  python3 deploy/install-config.py upsert WEB_BIND "${WEB_BIND:-127.0.0.1}" .env
  python3 deploy/install-config.py upsert WEB_PORT "${WEB_PORT:-47832}" .env
  echo "前端监听：$([[ -n "${WEB_BIND:-}" ]] && echo "$WEB_BIND" || echo 127.0.0.1):$([[ -n "${WEB_PORT:-}" ]] && echo "$WEB_PORT" || echo 47832)"
fi

if [[ -z "${IMAGE_TAG:-}" ]]; then
  # CI 只在推送 git 标签时才会产生 v<版本> 标签；普通 main 推送只有 main / <short-sha> / latest。
  # 强行用 backend/package.json 的版本号会拉到不存在的标签，所以这里顺着 git 事实走。
  if release_tag="$(git describe --tags --exact-match --abbrev=0 2>/dev/null)" && [[ "$release_tag" == v* ]]; then
    IMAGE_TAG="$release_tag"
  else
    IMAGE_TAG=latest
  fi
fi
export IMAGE_REPOSITORY="${IMAGE_REPOSITORY:-}" IMAGE_TAG

if [[ "$IMAGE_TAG" == latest ]]; then
  echo "镜像标签：latest（main 分支最新构建；要固定版本请打 v* 标签或设 IMAGE_TAG=v2.4.8）"
else
  echo "镜像标签：${IMAGE_TAG}"
fi
echo "开始部署：不本地编译，直接拉取 CI 产出的镜像……"
exec ./deploy/install.sh "--image=${IMAGE_REPOSITORY:-}" --non-interactive --skip-source-update
