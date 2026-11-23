// Expo config plugin：release 构建开启 R8 代码压缩/优化与资源压缩，并清理重复的整包 Keep 规则。
// 由于 android/ 被 gitignore 且在 prebuild 时重新生成，构建与混淆配置统一通过插件持久化。

const fs = require('fs');
const path = require('path');
const { withAppBuildGradle, withDangerousMod, withGradleProperties } = require('@expo/config-plugins');

const PROPS = [
  { type: 'property', key: 'android.enableMinifyInReleaseBuilds', value: 'true' },
  { type: 'property', key: 'android.enableShrinkResourcesInReleaseBuilds', value: 'true' },
];

const DEFAULT_PROGUARD_PATTERN = /getDefaultProguardFile\(\s*(['"])proguard-android\.txt\1\s*\)/g;
const OPTIMIZED_PROGUARD_CALL = 'getDefaultProguardFile("proguard-android-optimize.txt")';

const REDUNDANT_KEEP_RULES = new Set([
  '# react-native-reanimated',
  '-keep class com.swmansion.reanimated.** { *; }',
  '-keep class com.facebook.react.turbomodule.** { *; }',
]);

function applyReleaseGradleProperties(properties) {
  const next = [...properties];
  for (const prop of PROPS) {
    const existing = next.findIndex((item) => item.type === 'property' && item.key === prop.key);
    if (existing >= 0) {
      next[existing] = { ...next[existing], value: prop.value };
    } else {
      next.push({ ...prop });
    }
  }
  return next;
}

function applyOptimizeProguardFile(contents) {
  if (contents.includes('proguard-android-optimize.txt')) {
    return contents;
  }
  if (!DEFAULT_PROGUARD_PATTERN.test(contents)) {
    throw new Error(
      'withReleaseOptimizations: getDefaultProguardFile("proguard-android.txt") not found in android/app/build.gradle'
    );
  }
  DEFAULT_PROGUARD_PATTERN.lastIndex = 0;
  return contents.replace(DEFAULT_PROGUARD_PATTERN, OPTIMIZED_PROGUARD_CALL);
}

// 移除已被 react-native-reanimated 消费端规则覆盖的重复整包保留规则。
function cleanRedundantProguardRules(contents) {
  const filtered = contents
    .split('\n')
    .filter((line) => !REDUNDANT_KEEP_RULES.has(line.trim()))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');
  return filtered;
}

function withReleaseOptimizations(config) {
  config = withGradleProperties(config, (cfg) => {
    cfg.modResults = applyReleaseGradleProperties(cfg.modResults);
    return cfg;
  });

  config = withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') {
      throw new Error('withReleaseOptimizations: only groovy android/app/build.gradle is supported');
    }
    cfg.modResults.contents = applyOptimizeProguardFile(cfg.modResults.contents);
    return cfg;
  });

  config = withDangerousMod(config, [
    'android',
    async (cfg) => {
      const proguardPath = path.join(cfg.modRequest.platformProjectRoot, 'app', 'proguard-rules.pro');
      if (fs.existsSync(proguardPath)) {
        const current = fs.readFileSync(proguardPath, 'utf8');
        const cleaned = cleanRedundantProguardRules(current);
        if (cleaned !== current) {
          fs.writeFileSync(proguardPath, cleaned, 'utf8');
        }
      }
      return cfg;
    },
  ]);

  return config;
}

withReleaseOptimizations.applyReleaseGradleProperties = applyReleaseGradleProperties;
withReleaseOptimizations.applyOptimizeProguardFile = applyOptimizeProguardFile;
withReleaseOptimizations.cleanRedundantProguardRules = cleanRedundantProguardRules;

module.exports = withReleaseOptimizations;
