# newapi-app 手机端（Expo）

用于连接 `new-api` 后端的手机端 App，界面尽量贴近 WebUI，支持：

- 自定义 `Base URL`
- 仅使用 `UserId + 系统访问令牌` 登录（请求头：`New-Api-User` + `Authorization: Bearer ...`）
- 首页统计、充值/兑换码、令牌管理、日志查询
- 管理员：兑换码管理、渠道管理

## 开发运行

```bash
npm install
npx expo start
```

扫码后首次进入会提示填写：`Base URL`、`UserId`、`系统访问令牌`。

## 打包 APK（本地）

前置：

- Node.js 18+
- JDK 17+
- Android SDK（已配置 `ANDROID_HOME` / `ANDROID_SDK_ROOT`），以及可用的 `adb`

步骤：

```bash
npx expo prebuild --platform android --clean
cd android
./gradlew assembleRelease
```

产物路径：

- `android/app/build/outputs/apk/release/app-release.apk`

如果只需要给测试人员快速安装，也可以构建 Debug 包：

```bash
npx expo prebuild --platform android --clean
cd android
./gradlew assembleDebug
```

产物路径：

- `android/app/build/outputs/apk/debug/app-debug.apk`
