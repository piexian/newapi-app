// Expo config plugin：release 构建开启 R8 代码压缩 + 资源压缩，显著缩小 dex 体积。
// 通过 withGradleProperties 持久化到 android/gradle.properties（android/ 被 prebuild 重新生成，
// 直接改 gradle.properties 会丢失，必须走 config plugin）。
// R8 会移除未使用的 Java/Kotlin 类（Expo/RN 框架代码大头），shrinkResources 配合移除无引用资源。
// 注意：R8 只作用于 release 构建，debug 不受影响。

const { withGradleProperties } = require('@expo/config-plugins');

const PROPS = [
  { type: 'property', key: 'android.enableMinifyInReleaseBuilds', value: 'true' },
  { type: 'property', key: 'android.enableShrinkResourcesInReleaseBuilds', value: 'true' },
];

module.exports = function withReleaseOptimizations(config) {
  return withGradleProperties(config, (cfg) => {
    for (const prop of PROPS) {
      const existing = cfg.modResults.findIndex(
        (item) => item.type === 'property' && item.key === prop.key
      );
      if (existing >= 0) {
        cfg.modResults[existing].value = prop.value;
      } else {
        cfg.modResults.push(prop);
      }
    }
    return cfg;
  });
};
