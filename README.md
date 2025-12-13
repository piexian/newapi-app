# newapi-app 手机端（Expo）

用于连接 `new-api` 后端的手机端 App。

- 自定义 `Base URL`
- 仅使用 `UserId + 系统访问令牌` 登录（请求头：`New-Api-User` + `Authorization: Bearer ...`）
- 首页统计、充值/兑换码、令牌管理、日志查询
- 管理员：兑换码管理、渠道管理

## 开发运行

```bash
npm install
npx expo start
```
