// Expo config plugin：在 prebuild 时向 android/app/build.gradle 注入 ABI 拆分配置。
// 目的：一次 assembleRelease 产出多个架构独立 APK（armeabi-v7a / arm64-v8a / x86 / x86_64），
// 替代单个包含全部 ABI 的臃肿 universal 包，压缩单包体积。
// 由于 android/ 被 gitignore 且会被 prebuild 重新生成，签名/拆分类配置必须通过 config plugin 持久化。

const { withAppBuildGradle } = require('@expo/config-plugins');

// 拆分的 ABI 列表；需与 android/gradle.properties 的 reactNativeArchitectures 覆盖一致
const ABIS = ['armeabi-v7a', 'arm64-v8a', 'x86', 'x86_64'];
// 是否额外产出一个 universal（全架构）包作为兜底。默认 false：只出各架构小包。
const UNIVERSAL_APK = false;

const INJECT = `
    // --- [withAbiSplits] ABI 拆分：一次构建产出多个架构独立 APK ---
    splits {
        abi {
            enable true
            reset()
            include ${ABIS.map((a) => `'${a}'`).join(', ')}
            universalApk ${UNIVERSAL_APK}
        }
    }

    // 拆分后每个 ABI 需独立 versionCode（base * 10 + ABI 偏移），避免版本冲突。
    // 用 def 局部变量而非 ext：applicationVariants 闭包内 ext 解析不到 android{} 里挂的属性。
    def abiVersionCodes = [${ABIS.map((a, i) => `'${a}': ${i + 1}`).join(', ')}]
    applicationVariants.all { variant ->
        variant.outputs.each { output ->
            def abiFilter = output.getFilter("ABI")
            if (abiFilter != null) {
                output.versionCodeOverride = defaultConfig.versionCode * 10 + abiVersionCodes[abiFilter]
            }
        }
    }
`;

module.exports = function withAbiSplits(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') {
      throw new Error('withAbiSplits: only groovy android/app/build.gradle is supported');
    }
    const contents = cfg.modResults.contents;
    if (contents.includes('[withAbiSplits]')) {
      return cfg; // 已注入，幂等
    }
    const anchor = /android\s*\{/;
    if (!anchor.test(contents)) {
      throw new Error('withAbiSplits: android { } block not found in android/app/build.gradle');
    }
    cfg.modResults.contents = contents.replace(anchor, (m) => `${m}${INJECT}`);
    return cfg;
  });
};
