// Expo config plugin：在 prebuild 时向 android/app/build.gradle 注入 ABI 拆分配置。
// 使用 AGP 8/9 公共 androidComponents.onVariants API 覆写分包 versionCode，
// 替代已在 AGP 9 中移除的 applicationVariants 旧 API，并兼容从旧插件输出增量迁移。

const { withAppBuildGradle } = require('@expo/config-plugins');

// 拆分的 ABI 列表；需与 android/gradle.properties 的 reactNativeArchitectures 覆盖一致
const ABIS = ['armeabi-v7a', 'arm64-v8a', 'x86', 'x86_64'];
// 是否额外产出一个 universal（全架构）包作为兜底。默认 false：只出各架构小包。
const UNIVERSAL_APK = false;

const SPLITS_INJECT = `
    // --- [withAbiSplits] ABI 拆分：一次构建产出多个架构独立 APK ---
    splits {
        abi {
            enable true
            reset()
            include ${ABIS.map((a) => `'${a}'`).join(', ')}
            universalApk ${UNIVERSAL_APK}
        }
    }
`;

const VARIANT_VERSION_INJECT = `
// --- [withAbiSplits:versionCode] 为每个 ABI 分包分配独立 versionCode（base * 10 + ABI 偏移） ---
androidComponents {
    def abiVersionCodes = [${ABIS.map((a, i) => `'${a}': ${i + 1}`).join(', ')}]
    onVariants(selector().all()) { variant ->
        variant.outputs.each { output ->
            def abiFilter = output.filters.find {
                it.filterType == com.android.build.api.variant.FilterConfiguration.FilterType.ABI
            }?.identifier
            def abiOffset = abiVersionCodes[abiFilter]
            if (abiOffset != null) {
                def baseVersionCode = output.versionCode.getOrElse(0)
                output.versionCode.set(baseVersionCode * 10 + abiOffset)
            }
        }
    }
}
`;

// 按花括号嵌套深度定位并移除旧版插件注入的 applicationVariants.all 回调块，避免破坏外层 android {} 语法。
function removeLegacyApplicationVariantsBlock(contents) {
  const headerPattern =
    /(?:[ \t]*\/\/[^\n]*\n)*[ \t]*def\s+abiVersionCodes\s*=\s*\[[^\]]+\]\s*\n[ \t]*applicationVariants\.all\s*\{/g;
  const match = headerPattern.exec(contents);
  if (!match) return contents;

  const blockStart = match.index;
  const openBraceIndex = match.index + match[0].length - 1;
  let depth = 0;
  let closeBraceIndex = -1;

  for (let i = openBraceIndex; i < contents.length; i += 1) {
    const ch = contents[i];
    if (ch === '{') {
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        closeBraceIndex = i;
        break;
      }
    }
  }

  if (closeBraceIndex === -1) return contents;

  const matchedBlock = contents.slice(blockStart, closeBraceIndex + 1);
  if (!matchedBlock.includes('versionCodeOverride')) return contents;

  let removeStart = blockStart;
  while (removeStart > 0 && contents[removeStart - 1] === '\n') {
    removeStart -= 1;
  }
  let removeEnd = closeBraceIndex + 1;
  if (contents[removeEnd] === '\n') {
    removeEnd += 1;
  }

  const before = contents.slice(0, removeStart);
  const after = contents.slice(removeEnd);
  return `${before}${before && after ? '\n' : ''}${after}`;
}

function applyAbiSplitsToBuildGradle(contents) {
  let next = removeLegacyApplicationVariantsBlock(contents);

  if (!next.includes('[withAbiSplits]')) {
    const anchor = /android\s*\{/;
    if (!anchor.test(next)) {
      throw new Error('withAbiSplits: android { } block not found in android/app/build.gradle');
    }
    next = next.replace(anchor, (m) => `${m}${SPLITS_INJECT}`);
  }

  if (!next.includes('[withAbiSplits:versionCode]')) {
    next = `${next.trimEnd()}\n${VARIANT_VERSION_INJECT}`;
  }

  return next;
}

function withAbiSplits(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') {
      throw new Error('withAbiSplits: only groovy android/app/build.gradle is supported');
    }
    cfg.modResults.contents = applyAbiSplitsToBuildGradle(cfg.modResults.contents);
    return cfg;
  });
}

withAbiSplits.ABIS = ABIS;
withAbiSplits.applyAbiSplitsToBuildGradle = applyAbiSplitsToBuildGradle;
withAbiSplits.removeLegacyApplicationVariantsBlock = removeLegacyApplicationVariantsBlock;

module.exports = withAbiSplits;
