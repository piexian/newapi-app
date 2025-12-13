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

## 本地打包 APK（Gradle）

前置：

- Node.js 18+（推荐 Node 20 LTS）
- JDK 17+
- Android SDK（已配置 `ANDROID_HOME`/`ANDROID_SDK_ROOT`）

步骤：

```bash
npx expo prebuild --platform android --clean
cd android
./gradlew assembleRelease
```

产物：

- `android/app/build/outputs/apk/release/app-release.apk`

## Android Release 签名

已生成并接入：

- 密钥库：`credentials/android/newapi-app-release.keystore`
- 签名信息（含密码）：`credentials/android/SIGNING_INFO.txt`
- Gradle 配置文件：`android/keystore.properties`（由脚本生成）

注意：签名文件和密码请妥善保管，不要提交到公开仓库。

## EAS 构建（使用本地签名）

本项目的 `eas.json` 已配置 `credentialsSource: local`，并已生成 `credentials.json`（含签名密码，已加入 `.gitignore`）。

示例（构建 APK 便于测试安装）：

```bash
npx --yes eas-cli@latest build --platform android --profile production
```

