const appConfig = require('../app.json');
const withAbiSplits = require('../plugins/withAbiSplits');
const withCleartextTraffic = require('../plugins/withCleartextTraffic');
const withReleaseOptimizations = require('../plugins/withReleaseOptimizations');

const SAMPLE_BUILD_GRADLE = `
apply plugin: "com.android.application"

android {
    compileSdk 35
    defaultConfig {
        versionCode 5
        versionName "1.2.3"
    }
    buildTypes {
        release {
            minifyEnabled enableMinifyInReleaseBuilds
            proguardFiles getDefaultProguardFile("proguard-android.txt"), "proguard-rules.pro"
        }
    }
}
`;

describe('Android Expo config plugins', () => {
  describe('withAbiSplits', () => {
    it('injects ABI splits and AGP 8/9 androidComponents.onVariants versionCode logic', () => {
      const result = withAbiSplits.applyAbiSplitsToBuildGradle(SAMPLE_BUILD_GRADLE);

      expect(result).toContain('splits {');
      expect(result).toContain("include 'armeabi-v7a', 'arm64-v8a', 'x86', 'x86_64'");
      expect(result).toContain('universalApk false');
      expect(result).toContain('androidComponents {');
      expect(result).toContain('onVariants(selector().all())');
      expect(result).toContain('FilterConfiguration.FilterType.ABI');
      expect(result).toContain('output.versionCode.set(baseVersionCode * 10 + abiOffset)');
      expect(result).not.toContain('applicationVariants.all');
    });

    it('is idempotent when applied twice', () => {
      const once = withAbiSplits.applyAbiSplitsToBuildGradle(SAMPLE_BUILD_GRADLE);
      const twice = withAbiSplits.applyAbiSplitsToBuildGradle(once);
      expect(twice).toBe(once);
    });

    it('migrates legacy applicationVariants output cleanly during incremental prebuild', () => {
      const legacyGradle = `
apply plugin: "com.android.application"

android {
    // --- [withAbiSplits] ABI 拆分：一次构建产出多个架构独立 APK ---
    splits {
        abi {
            enable true
            reset()
            include 'armeabi-v7a', 'arm64-v8a', 'x86', 'x86_64'
            universalApk false
        }
    }

    // 拆分后每个 ABI 需独立 versionCode（base * 10 + ABI 偏移），避免版本冲突。
    // 用 def 局部变量而非 ext：applicationVariants 闭包内 ext 解析不到 android{} 里挂的属性。
    def abiVersionCodes = ['armeabi-v7a': 1, 'arm64-v8a': 2, 'x86': 3, 'x86_64': 4]
    applicationVariants.all { variant ->
        variant.outputs.each { output ->
            def abiFilter = output.getFilter("ABI")
            if (abiFilter != null) {
                output.versionCodeOverride = defaultConfig.versionCode * 10 + abiVersionCodes[abiFilter]
            }
        }
    }

    compileSdk 36
}
`;
      const migrated = withAbiSplits.applyAbiSplitsToBuildGradle(legacyGradle);
      expect(migrated).not.toContain('applicationVariants.all');
      expect(migrated).not.toContain('versionCodeOverride');
      expect(migrated).toContain('splits {');
      expect(migrated).toContain('androidComponents {');
      expect(migrated).toContain('onVariants(selector().all())');
      expect(withAbiSplits.applyAbiSplitsToBuildGradle(migrated)).toBe(migrated);
    });

    it('throws when android block is missing', () => {
      expect(() => withAbiSplits.applyAbiSplitsToBuildGradle('dependencies {}')).toThrow(
        /android \{ \} block not found/
      );
    });
  });

  describe('withReleaseOptimizations', () => {
    it('enables R8 minification and resource shrinking in gradle.properties', () => {
      const props = withReleaseOptimizations.applyReleaseGradleProperties([
        { type: 'property', key: 'android.enableMinifyInReleaseBuilds', value: 'false' },
        { type: 'property', key: 'org.gradle.parallel', value: 'true' },
      ]);

      expect(props).toEqual([
        { type: 'property', key: 'android.enableMinifyInReleaseBuilds', value: 'true' },
        { type: 'property', key: 'org.gradle.parallel', value: 'true' },
        { type: 'property', key: 'android.enableShrinkResourcesInReleaseBuilds', value: 'true' },
      ]);
    });

    it('switches default proguard file to proguard-android-optimize.txt idempotently', () => {
      const once = withReleaseOptimizations.applyOptimizeProguardFile(SAMPLE_BUILD_GRADLE);
      expect(once).toContain('getDefaultProguardFile("proguard-android-optimize.txt")');
      expect(once).not.toContain('proguard-android.txt');

      const twice = withReleaseOptimizations.applyOptimizeProguardFile(once);
      expect(twice).toBe(once);
    });

    it('throws when build.gradle has neither default proguard file', () => {
      expect(() => withReleaseOptimizations.applyOptimizeProguardFile('android {}')).toThrow(
        /proguard-android\.txt/
      );
    });

    it('removes redundant reanimated/turbomodule keep rules while keeping custom rules', () => {
      const sample = [
        '# Custom header',
        '',
        '# react-native-reanimated',
        '-keep class com.swmansion.reanimated.** { *; }',
        '-keep class com.facebook.react.turbomodule.** { *; }',
        '',
        '-keep class com.newapi.mobile.CustomKeep { *; }',
      ].join('\n');

      const cleaned = withReleaseOptimizations.cleanRedundantProguardRules(sample);
      expect(cleaned).not.toContain('com.swmansion.reanimated.**');
      expect(cleaned).not.toContain('com.facebook.react.turbomodule.**');
      expect(cleaned).toContain('-keep class com.newapi.mobile.CustomKeep { *; }');
    });
  });

  describe('withCleartextTraffic', () => {
    it('enables android:usesCleartextTraffic on main application node', () => {
      const manifest = {
        manifest: {
          application: [{ $: { 'android:name': '.MainApplication' } }],
        },
      };

      const updated = withCleartextTraffic.applyCleartextTraffic(manifest);
      expect(updated.manifest.application[0].$['android:usesCleartextTraffic']).toBe('true');
    });
  });

  describe('app.json Android configuration', () => {
    it('blocks unnecessary permissions and configures resize keyboard mode', () => {
      expect(appConfig.expo.android.softwareKeyboardLayoutMode).toBe('resize');
      expect(appConfig.expo.android.blockedPermissions).toEqual(
        expect.arrayContaining([
          'android.permission.SYSTEM_ALERT_WINDOW',
          'android.permission.READ_EXTERNAL_STORAGE',
          'android.permission.WRITE_EXTERNAL_STORAGE',
        ])
      );
      expect(appConfig.expo.plugins).toEqual(
        expect.arrayContaining([
          './plugins/withAbiSplits.js',
          './plugins/withReleaseOptimizations.js',
          './plugins/withCleartextTraffic.js',
        ])
      );
    });
  });
});
