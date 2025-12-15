# newapi-app 手机端（Expo）

用于连接 `new-api` 后端的手机端 App，支持自定义服务地址，并以 `UserId` + 系统访问令牌的方式调用接口。

## 上游项目与说明

- 本项目为 `New API` 后端的配套移动端 App，接口与功能设计基于该项目。
- 本仓库内后端参考实现位于 [new-api](https://github.com/QuantumNous/new-api)上游项目。

## 主要功能

- **登录与配置**：在登录页或设置页保存 Base URL、`New-Api-User` 与 `Authorization: Bearer ...` 令牌，支持密钥显示/隐藏与一键退出登录。
- **首页看板**：展示账户余额、历史消耗、请求次数、近 1/7/30 天额度与 Token 统计、模型消耗分布以及账号信息，支持下拉刷新。
- **充值/兑换**：
  - 查看充值配置、预设金额与支付方式，生成在线支付链接或使用内嵌 WebView 完成支付。
  - 查看个人充值记录，按关键词分页筛选。
  - 输入兑换码兑换额度，自动复制充值链接、支持最小金额校验。
- **令牌管理**：
  - 分页查看令牌列表（掩码显示密钥），支持开启/禁用、编辑额度与过期时间、模型限制、IP 白名单等字段。
  - 新建或编辑令牌时校验 JSON 附加配置与数值字段，支持开启无限额度。
- **日志查询**：
  - 查看个人日志统计与明细，按类型、令牌、模型、分组及时间范围过滤，并支持快捷选择「今天」「近 7/30 天」。
  - 列表支持分页、复制请求/响应详情，查看关联额度与 Tokens 消耗。
- **设置**：随时调整 Base URL、用户标识与系统访问令牌，提供隐藏/显示密钥与退出登录入口。
- **管理员入口**：管理员可进入兑换码管理（批量生成、启用/禁用、删除、清理失效）、渠道管理（查看、启用/禁用、编辑基础信息）以及用户管理（搜索、编辑、启用/禁用、重置 2FA/Passkey、注销）。

界面预览
<table>
  <tr>
    <td><img src="https://github.com/user-attachments/assets/b1668ef6-e382-461b-b4d3-cce483aa4d8d" width="300"/></td>
    <td><img src="https://github.com/user-attachments/assets/7dc744d1-8127-4198-8928-2bab652a2bad" width="300"/></td>
    <td><img src="https://github.com/user-attachments/assets/23a1faec-19dd-48da-b5cc-0a2bf1613bb4" width="300"/></td>
  </tr>
  <tr>
    <td><img src="https://github.com/user-attachments/assets/4723c777-3731-461b-9e98-62e1d9dc09aa" width="300"/></td>
    <td><img src="https://github.com/user-attachments/assets/10d1f557-90ac-4492-af4c-1d3ea03879df" width="300"/></td>
    <td><img src="https://github.com/user-attachments/assets/2e573478-9434-4beb-a442-a855a657fb94" width="300"/></td>
  </tr>
  <tr>
    <td><img src="https://github.com/user-attachments/assets/dac063fa-afd4-46bf-880f-863feda5150b" width="300"/></td>
    <td><img src="https://github.com/user-attachments/assets/5dac4b00-b627-4168-9804-3aaf702d1341" width="300"/></td>
    <td><img src="https://github.com/user-attachments/assets/866126f7-ccd0-4f87-957a-9a9e179f6106" width="300"/></td>
  </tr>
</table>



## 开发运行

```bash
npm install
npx expo start
```

## License

本项目（`LoginApp`）采用 MIT License，详见 `LICENSE`。  
上游 `New API` 后端项目使用其自身的许可证条款（请以对应仓库为准）。
