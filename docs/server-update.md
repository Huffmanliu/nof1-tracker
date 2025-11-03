# 服务器更新指南

## 📋 更新步骤

### 方法一：如果程序在后台运行（推荐）

**1. 停止正在运行的程序**

根据您使用的运行方式，选择对应的命令：

```bash
# 如果使用 pm2 运行
pm2 stop nof1-tracker

# 如果使用 systemd 服务
sudo systemctl stop nof1-tracker

# 如果使用 nohup 或 screen，需要找到进程并停止
ps aux | grep "node dist/index.js"
kill <进程ID>
```

**2. 进入项目目录**

```bash
cd /opt/nof1-tracker
```

**3. 拉取最新代码**

```bash
# 如果使用 HTTPS 且需要认证
git pull

# 如果使用 HTTPS 但遇到认证问题，可以使用 GitHub Token
# 方式1: 临时设置环境变量（不推荐，不安全）
# GIT_ASKPASS=echo git pull https://YOUR_TOKEN@github.com/用户名/仓库名.git

# 方式2: 配置 git credential helper（推荐）
git config --global credential.helper store
# 然后在首次 git pull 时会提示输入用户名和 token
# Username: your-email@example.com
# Password: 粘贴您的 GitHub Personal Access Token（不是密码）

# 方式3: 使用 SSH（最推荐，需要配置SSH key）
# 如果已经配置SSH key，直接：
git pull
```

**4. 安装新的依赖（如果有新增）**

```bash
npm install
```

**5. 重新构建项目**

```bash
npm run build
```

**6. 重新启动程序**

```bash
# 使用 pm2
pm2 restart nof1-tracker

# 使用 systemd
sudo systemctl start nof1-tracker

# 使用 nohup
nohup npm start -- follow <agent-name> --interval 30 > output.log 2>&1 &

# 使用 screen
screen -S nof1-tracker
npm start -- follow <agent-name> --interval 30
# 按 Ctrl+A 然后 D 退出 screen
```

### 方法二：如果程序在前台运行（简单场景）

**1. 停止当前程序**
- 按 `Ctrl+C` 停止当前运行的程序

**2. 执行更新**

```bash
cd /opt/nof1-tracker
git pull
npm install  # 如果有新的依赖
npm run build
```

**3. 重新启动**

```bash
# 持续监控跟单（每30秒检查一次）
npm start -- follow gpt-5 --interval 30

# 或者根据您的具体需求调整命令
npm start -- follow <agent-name> --interval <秒数> [其他选项]
```

## ⚠️ 重要注意事项

### 1. GitHub Token 使用

**⚠️ 安全警告**：GitHub Personal Access Token 是敏感信息，不要直接在命令行中使用。

**推荐做法**：
- 使用 SSH key 认证（最安全）
- 配置 git credential helper
- 使用 GitHub CLI (`gh auth login`)

**不推荐**：
- 在命令行中直接粘贴 token（会记录到 shell history）
- 将 token 提交到代码仓库

### 2. 检查更新内容

更新前建议先查看 changelog：

```bash
cat CHANGELOG.md
```

### 3. 环境变量检查

更新后确保 `.env` 文件没有被覆盖：

```bash
# 检查 .env 文件是否存在
ls -la .env

# 如果不存在，从示例文件创建
cp .env.example .env
# 然后编辑 .env 填入您的配置
```

### 4. 验证更新

更新后建议先测试：

```bash
# 查看可用 Agent
npm start -- agents

# 风险控制模式测试（不会真实交易）
npm start -- follow <agent-name> --risk-only

# 测试正常后再启动正式跟单
```

## 🔧 常见问题

### Q1: git pull 提示需要认证

**解决方案**：
```bash
# 方案1: 配置 SSH key（推荐）
ssh-keygen -t ed25519 -C "your_email@example.com"
# 将 ~/.ssh/id_ed25519.pub 添加到 GitHub

# 方案2: 使用 HTTPS + credential helper
git config --global credential.helper store
git pull
# 输入用户名和 token（不是密码）
```

### Q2: npm run build 失败

**检查**：
```bash
# 检查 Node.js 版本（需要 >= 18.0.0）
node -v

# 检查 npm 版本
npm -v

# 清理后重新安装
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Q3: 程序启动失败

**检查**：
```bash
# 检查环境变量
cat .env

# 检查构建产物
ls -la dist/

# 查看错误日志
npm start -- follow <agent-name> 2>&1 | tee error.log
```

## 📝 快速更新脚本

您可以创建一个更新脚本 `update.sh`：

```bash
#!/bin/bash
set -e

echo "🔄 开始更新 nof1-tracker..."

# 进入项目目录
cd /opt/nof1-tracker

# 停止程序（如果使用 pm2）
if command -v pm2 &> /dev/null; then
    echo "⏸️  停止程序..."
    pm2 stop nof1-tracker || true
fi

# 拉取代码
echo "📥 拉取最新代码..."
git pull

# 安装依赖
echo "📦 安装依赖..."
npm install

# 构建
echo "🔨 构建项目..."
npm run build

# 重启程序（如果使用 pm2）
if command -v pm2 &> /dev/null; then
    echo "▶️  重启程序..."
    pm2 restart nof1-tracker
    pm2 logs nof1-tracker --lines 20
fi

echo "✅ 更新完成！"
```

使用方式：
```bash
chmod +x update.sh
./update.sh
```

## 🎯 您的问题解答

根据您提供的命令，正确的更新流程应该是：

```bash
# 1. 停止当前程序
# （根据您的运行方式选择）

# 2. 拉取代码
cd /opt/nof1-tracker
git pull

# 3. 安装依赖（如果有新增）
npm install

# 4. 重新构建
npm run build

# 5. 重新启动（注意命令格式）
npm start -- follow <agent-name> --interval 30
# 例如：
npm start -- follow gpt-5 --interval 30
```

**注意**：
- `npm start --agent` ❌ 不正确
- `npm start -- follow <agent-name>` ✅ 正确
- GitHub token 不应该在启动命令中使用，应该在 git pull 时用于认证（如果使用 HTTPS）

