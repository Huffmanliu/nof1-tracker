# GitHub 推送问题排查与解决方案

## 问题描述

在使用 `git push` 推送代码到 GitHub 时，可能会遇到以下错误：

```
fatal: unable to access 'https://github.com/username/repo.git/': GnuTLS recv error (-110): The TLS connection was non-properly terminated.
```

或

```
fatal: unable to access 'https://github.com/username/repo.git/': Failed to connect to github.com port 443 after 134142 ms: Couldn't connect to server
```

## 问题原因

这些错误通常由以下原因导致：

1. **网络连接问题** - 无法直接访问 GitHub 服务器
2. **TLS/SSL 连接中断** - GnuTLS 错误表示 TLS 握手失败或连接被非正常终止
3. **防火墙限制** - 某些网络环境可能限制了对 GitHub 的访问
4. **网络超时** - 连接超时导致推送失败

## 解决方案

### 方案 1: 配置代理（推荐）

如果您有可用的代理服务（如 Qv2ray、Clash 等），可以通过配置 Git 代理来解决：

#### 设置代理

```bash
# 配置 HTTP 和 HTTPS 代理
git config --global http.proxy http://127.0.0.1:8889
git config --global https.proxy http://127.0.0.1:8889
```

**注意**: 请将 `127.0.0.1:8889` 替换为您实际的代理地址和端口。

常见代理端口：
- Qv2ray: `8889`
- Clash: `7890` 或 `7891`
- V2Ray: `10808` 或 `10809`

#### 验证代理配置

```bash
# 查看当前代理配置
git config --global --get-regexp proxy

# 测试代理连接（使用 curl）
curl -I --proxy http://127.0.0.1:8889 https://github.com
```

如果看到 `HTTP/2 200` 响应，说明代理配置成功。

#### 取消代理配置

如果将来不需要使用代理，可以取消配置：

```bash
# 取消 HTTP 代理
git config --global --unset http.proxy

# 取消 HTTPS 代理
git config --global --unset https.proxy

# 验证是否已取消
git config --global --get-regexp proxy
# 应该没有任何输出
```

### 方案 2: 使用 SSH 替代 HTTPS

SSH 方式通常更稳定，且不需要每次输入密码：

#### 步骤 1: 生成 SSH Key（如果没有）

```bash
# 生成新的 SSH key（推荐使用 ed25519）
ssh-keygen -t ed25519 -C "your_email@example.com"

# 或者使用 RSA（兼容性更好，但不推荐）
ssh-keygen -t rsa -b 4096 -C "your_email@example.com"
```

按提示操作，可以设置密码或直接回车（不设置密码）。

#### 步骤 2: 查看公钥内容

```bash
# 显示 ed25519 公钥
cat ~/.ssh/id_ed25519.pub

# 或显示 RSA 公钥
cat ~/.ssh/id_rsa.pub
```

#### 步骤 3: 添加 SSH Key 到 GitHub

1. 复制公钥内容（整个输出）
2. 登录 GitHub，进入 **Settings** -> **SSH and GPG keys**
3. 点击 **New SSH key**
4. 填写 Title（任意名称），将公钥内容粘贴到 Key 字段
5. 点击 **Add SSH key** 保存

#### 步骤 4: 测试 SSH 连接

```bash
# 测试 GitHub SSH 连接
ssh -T git@github.com
```

如果成功，会看到类似消息：
```
Hi username! You've successfully authenticated, but GitHub does not provide shell access.
```

#### 步骤 5: 切换远程仓库为 SSH

```bash
# 切换到 SSH URL
git remote set-url origin git@github.com:username/repo.git

# 验证
git remote -v
```

现在可以使用 SSH 方式推送，不需要代理：

```bash
git push origin master
```

#### 切换回 HTTPS

如果将来想切换回 HTTPS：

```bash
git remote set-url origin https://github.com/username/repo.git
```

### 方案 3: 增加 Git 超时时间

如果网络较慢但可以连接，可以增加超时时间：

```bash
# 设置 HTTP 超时时间为 10 分钟
git config --global http.timeout 600

# 增加缓冲区大小
git config --global http.postBuffer 524288000
```

### 方案 4: 使用 Personal Access Token

GitHub 已不再支持使用密码进行 HTTPS 推送，需要使用 Personal Access Token：

#### 创建 Token

1. 登录 GitHub，进入 **Settings** -> **Developer settings** -> **Personal access tokens** -> **Tokens (classic)**
2. 点击 **Generate new token (classic)**
3. 设置名称和过期时间
4. 勾选 `repo` 权限（至少需要 `repo` 权限才能推送代码）
5. 点击 **Generate token** 并复制 token（只显示一次）

#### 使用 Token

推送时：
- **Username**: 您的 GitHub 用户名
- **Password**: 粘贴刚才复制的 token（不是 GitHub 密码）

## 快速检查清单

遇到推送问题时，按以下顺序检查：

- [ ] 检查网络连接：`ping github.com`
- [ ] 检查代理是否开启并配置正确
- [ ] 尝试使用 SSH 方式
- [ ] 确认 GitHub 凭证是否正确（用户名/密码或 token）
- [ ] 检查远程仓库 URL：`git remote -v`
- [ ] 尝试增加超时时间

## 常见问题

### Q: 如何查看当前 Git 配置？

```bash
# 查看所有配置
git config --global --list

# 查看代理相关配置
git config --global --get-regexp proxy

# 查看远程仓库配置
git remote -v
```

### Q: 如何临时使用代理（仅当前仓库）？

```bash
# 在仓库目录下执行（不使用 --global）
cd /path/to/repo
git config http.proxy http://127.0.0.1:8889
git config https.proxy http://127.0.0.1:8889
```

### Q: 代理配置后仍然失败？

1. 确认代理服务正在运行
2. 检查代理端口是否正确
3. 尝试使用 `curl` 测试代理连接
4. 检查是否有其他网络限制

### Q: 如何同时为多个 Git 服务配置代理？

可以为特定域名配置代理：

```bash
# 仅为 GitHub 配置代理
git config --global http.https://github.com.proxy http://127.0.0.1:8889
```

## 总结

**推荐的解决方案**：

1. **有代理可用** → 使用方案 1（配置代理）
2. **无代理但可访问 GitHub** → 使用方案 2（SSH 方式）
3. **网络较慢** → 使用方案 3（增加超时时间）

**取消代理的方法**：

```bash
git config --global --unset http.proxy
git config --global --unset https.proxy
```

---

**最后更新**: 2025-11-03  
**适用版本**: Git 2.0+  
**测试环境**: Linux, macOS, Windows (Git Bash)


