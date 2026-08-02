# 灵动打卡 H5 · CloudBase 云函数

本目录是 H5（`../index.html` + `../script.js`）云端同步依赖的 3 个云函数，**已在 CloudBase 环境 `richieshao-1980-d9f5588r8f7850a1` 部署前完成源码适配**（从原小程序 `wx-server-sdk` 版本改写为 `@cloudbase/node-sdk`）。

## 函数清单

| 函数名 | 作用 | 前端调用 | 返回 |
|---|---|---|---|
| `getUnionid` | 微信内网页 OAuth code 换 unionid（仅微信内 + 已配 CLOUD_MP_APPID 时触发） | `callFunction({name:'getUnionid', data:{code}})` | `{ ok, unionid, openid, from, fallback }` |
| `pull` | 拉取用户云端数据（uid 为主键） | `callFunction({name:'pull', data:{uid}})` | `{ ok, data, updatedAt }` |
| `push` | 写入/覆盖用户云端数据（LWW 由 updatedAt 控制） | `callFunction({name:'push', data:{uid, data, updatedAt}})` | `{ ok }` |

## 部署前必做（控制台）

1. **建数据库集合**：CloudBase 控制台 → 数据库 → 新建集合 `sync`（文档型）。
   - 每个用户一条文档，`_id` = 用户 uid，字段 `{ data, updatedAt }`。
2. **配 Web 安全域名**：CloudBase 控制台 → 环境 → 安全配置 → Web 安全域名，把 H5 的访问域名加进去。
   - 若用 GitHub Pages：`richieshao.github.io`
   - 若用 CloudBase 静态托管：`richieshao-1980-d9f5588r8f7850a1-1450128794.ap-shanghai.app.tcloudbase.com`
3. **（可选）公众号跨端互通**：若要让 H5 在微信内拿到 unionid 实现跨端同步，需：
   - 在 `script.js` 填 `CLOUD_MP_APPID`（公众号 AppID）；
   - 给 `getUnionid` 函数配置环境变量 `MP_APPID`、`MP_SECRET`（公众号 AppID / AppSecret）；
   - 公众号需绑定微信开放平台账号才能拿到 unionid。

## 部署方式

### 方式 A：CloudBase CLI（推荐，本仓库随源码部署）
```bash
npm i -g @cloudbase/cli
tcb login                 # 浏览器扫码登录你的腾讯云账号
cd cloudfunctions
# 逐个部署（envId 已填你的环境）
tcb fn deploy getUnionid --envId richieshao-1980-d9f5588r8f7850a1
tcb fn deploy pull       --envId richieshao-1980-d9f5588r8f7850a1
tcb fn deploy push       --envId richieshao-1980-d9f5588r8f7850a1
```

### 方式 B：控制台手动上传
CloudBase 控制台 → 云函数 → 新建（名称同上）→ 运行环境 Nodejs 16/18 → 上传 `index.js` + `package.json`，保存并安装依赖。

## 与小程序版的区别（已适配）
- SDK：`wx-server-sdk` → `@cloudbase/node-sdk`；`cloud.DYNAMIC_CURRENT_ENV` → `cloudbase.SYMBOL_CURRENT_ENV`。
- 身份校验：`cloud.getWXContext()`（微信上下文 UNIONID/OPENID）→ `app.auth().getEndUserInfo()`（CloudBase 调用方 uid），越权防护逻辑保留。
- 数据库：`cloud.database()` → `app.database()`，集合名 `sync`、文档主键、LWW 逻辑不变。
- `getUnionid` 仅保留微信网页 OAuth code 交换分支（小程序/APP 的微信上下文分支由小程序工程 `lingdong-daka-miniprogram/cloudfunctions/` 另行处理）。

> 小程序工程里仍保留原 `wx-server-sdk` 版本（用于微信云开发），本目录是 H5/CloudBase 专用版本，二者互不影响。
