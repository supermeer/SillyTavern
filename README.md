# SillyTavern

LLM Frontend for Power Users

## Resources

- GitHub: <https://github.com/SillyTavern/SillyTavern>
- Docs: <https://docs.sillytavern.app/>
- Discord: <https://discord.gg/sillytavern>
- Reddit: <https://reddit.com/r/SillyTavernAI>

## License

AGPL-3.0

---

## 部署公网访问（开放 AI 请求消息查看）

本项目已定制化添加了一个 **OpenAI Request Messages 查看器**，允许公网用户访问时在页面右下角看到一个悬浮按钮，点击后可以实时查看最近一次 AI 请求发送的消息内容。

### 功能说明

每次你向 AI 发送消息时，系统会将完整的 `messages` 数组写入根目录的 `openai-request-messages.json` 文件。公网用户访问时，右下角会显示一个 🤖 悬浮按钮，点击即可查看：

- 消息列表（包含 `role` 和 `content`）
- 每条消息按角色着色（蓝色=user，绿色=assistant，灰色=system）
- **3 秒自动刷新**，无需手动刷新页面
- 可拖拽移动面板位置
- 可通过浏览器控制台 `toggleOpenAIMessages()` 手动开关

### 部署步骤

#### 方式一：直接用 Node 部署（推荐）

```bash
# 安装依赖
npm install

# 启动服务（默认端口 8000）
npm start

# 或者指定端口
PORT=3000 npm start
```

#### 方式二：Docker 部署

项目根目录已有 Dockerfile：

```bash
docker build -t sillytavern .
docker run -d -p 8000:8000 --name sillytavern sillytavern
```

> 注意：Docker 方式部署时，`openai-request-messages.json` 会写入容器内部。如需持久化，添加 volume 映射：
> `docker run -d -p 8000:8000 -v ./data:/app sillytavern`

#### 方式三：宝塔 / 1Panel 等面板部署

1. 在面板中创建 Node.js 项目
2. 项目目录指向 SillyTavern 根目录
3. 启动命令：`node server.js`
4. 绑定域名，设置反代（可选）

#### 公网访问配置

- 默认情况下服务监听 `0.0.0.0:8000`，可直接通过 `http://你的服务器IP:8000` 访问
- 如需域名访问，在 Nginx/Caddy 中配置反向代理：

```nginx
# Nginx 示例
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### API 接口

| 接口 | 方法 | 说明 | 是否需要登录 |
|------|------|------|------------|
| `/api/openai-messages` | GET | 获取最新的 messages 数组 | ❌ 不需要 |
| `/version` | GET | 获取版本信息 | ❌ 不需要 |
| 其他 `/api/*` 接口 | - | 详见官方文档 | ✅ 需要 |

### 安全说明

- `GET /api/openai-messages` 是公开接口，**任何人访问都能看到消息内容**
- 如果你需要限制访问，请配合 Nginx Basic Auth 或在域名层面加认证
- 完整的用户数据（聊天记录等）仍然需要登录才能访问
- 该功能仅暴露 AI 请求的 messages 结构，不包含 API Key

### 消息面板使用方式

1. 访问网站后，页面右下角有一个 🤖 图标按钮
2. 点击按钮 → 弹出消息面板，自动开始拉取数据
3. 面板每 3 秒自动刷新，显示最新的 AI 请求内容
4. 点击 ❌ 关闭面板（按钮仍保留）
5. 再次点击 🤖 按钮重新打开
6. 面板可拖拽移动位置
