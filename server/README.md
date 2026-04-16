# EcoQuest Auth Server (Cookie Session)

这是 EcoQuest 的最小可部署登录后端：Express + MySQL（Aiven） + HttpOnly Cookie Session。

## 目录
- `src/index.js`: 服务器入口与路由
- `db/schema.sql`: 建表 SQL（`users` + `user_sessions`）
- `scripts/init-db.js`: 初始化数据库脚本

## 环境变量
复制 `.env.example` 为 `.env` 并填写：
- `MYSQL_URL`: MySQL 连接串（必填，推荐用这个；也可复用 `DATABASE_URL`）
- `SESSION_SECRET`: Session 密钥（必填，生产环境必须强随机）
- `FRONTEND_ORIGIN`: 前端地址（用于 CORS，必须与浏览器访问前端的 origin 一致）

## 本地运行（推荐）
1. 安装依赖

```bash
cd server
npm install
```

2. 初始化数据库表

```bash
cd server
npm run db:init
```

3. 启动后端

```bash
cd server
npm run dev
```

## 前端联调
`front.html` 里有一项：
- `apiBase: 'http://localhost:8080'`

确保前端不是用 `file://` 打开（那样 origin 会是 `null`，CORS 不好处理）。建议用一个静态服务器打开前端，例如 VSCode Live Server（通常是 `http://localhost:5500`），然后把后端的 `FRONTEND_ORIGIN` 设成同一个地址。

## 接口
- `POST /api/auth/register` `{ email, password, displayName? }`
- `POST /api/auth/login` `{ email, password }`
- `POST /api/auth/logout` `{}`
- `GET /api/auth/me` -> `{ user: {...} | null }`

## 部署注意（生产环境）
### Cookie 设置
- 生产环境默认 `secure=true`（需要 HTTPS）
- 如果 **前后端不同域名**：通常需要
  - `COOKIE_SAMESITE=none`
  - HTTPS（否则浏览器会拒绝 `SameSite=None` 的 cookie）
  - CORS：`credentials: true` 且 `FRONTEND_ORIGIN` 精确匹配前端 origin

### Session 存储
代码会优先使用 MySQL 的 `user_sessions` 表作为 session store（`express-mysql-session`），适合多实例部署。

## Vercel + Render/Railway + Aiven（推荐配置）
### 1) 前端（Vercel）
- 直接部署前端站点后拿到域名，例如 `https://your-app.vercel.app`

### 2) 数据库（Aiven MySQL）
- 在 Aiven 创建 MySQL 服务并拿到连接信息
- 生成 `MYSQL_URL`（示例）：

```text
mysql://USER:PASSWORD@HOST:PORT/DB?ssl={"rejectUnauthorized":true}
```

### 3) 后端（Render 或 Railway）
把以下环境变量配置到后端服务：
- `NODE_ENV=production`
- `PORT=8080`（平台一般会注入 PORT，也可不写）
- `FRONTEND_ORIGIN=https://your-app.vercel.app`
- `MYSQL_URL=...`（来自 Aiven）
- `SESSION_SECRET=...`（强随机）
- `COOKIE_SAMESITE=none`（前后端不同域名时必需）

首次部署后执行一次建表：
- 在服务的 Shell/Console 里运行 `npm run db:init`

### 运维：给指定用户设置金币（云端）
在 Render 环境变量中设置 **`ADMIN_SECRET`**（长随机串；不要写进前端仓库）。部署后可通过 HTTPS 调用后端（Render 域名），例如：

```bash
curl.exe -sS -X POST "https://fit5120-climatequest.onrender.com/api/admin/set-coins" -H "Content-Type: application/json" -H "X-Admin-Secret: YOUR_SECRET_HERE" -d "{\"username\":\"edq\",\"coins\":99999000}"
```

（PowerShell 下请用 `curl.exe`，避免被当成 `Invoke-WebRequest`。）

不设 `ADMIN_SECRET` 时服务器**不会注册**该路由。也可用本地脚本 `npm run db:grant-coins`（需配置 `MYSQL_URL`），与接口二选一即可。

### 运维：云端自动修正金币（无需手动调用接口）
如果你希望“push 后 Render 自动把某个用户的金币修正到一个值”，可以在 Render 环境变量里设置：

- `STARTUP_SET_COINS_USERNAME=edq`
- `STARTUP_SET_COINS_VALUE=999999`

服务每次启动都会尝试查找该用户并把 `user_state.coins` 更新为该值（幂等）。不设置这两个变量则不会执行任何自动修正。

