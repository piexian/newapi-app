// Expo config plugin：在主 AndroidManifest.xml 开启 usesCleartextTraffic，
// 以支持连接自托管内网 HTTP 协议的 new-api 实例。

const { AndroidConfig, withAndroidManifest } = require('@expo/config-plugins');

function applyCleartextTraffic(androidManifest) {
  const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(androidManifest);
  mainApplication.$['android:usesCleartextTraffic'] = 'true';
  return androidManifest;
}

function withCleartextTraffic(config) {
  return withAndroidManifest(config, (cfg) => {
    cfg.modResults = applyCleartextTraffic(cfg.modResults);
    return cfg;
  });
}

withCleartextTraffic.applyCleartextTraffic = applyCleartextTraffic;

module.exports = withCleartextTraffic;
