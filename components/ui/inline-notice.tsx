import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { StyleSheet, Text, View } from 'react-native';

import { Radius, type ToneName } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';

type InlineNoticeProps = {
  message: string;
  title?: string;
  /** 语义类型：danger（默认）、warning 或 success */
  tone?: Extract<ToneName, 'danger' | 'warning' | 'success'>;
};

function readableMessage(message: string) {
  if (/failed to fetch|network request failed/i.test(message)) {
    return '无法连接服务器，请检查地址或网络后重试。';
  }
  return message;
}

const TONE_META = {
  danger: { icon: 'error-outline', title: '请求失败' },
  warning: { icon: 'warning-amber', title: '安全提示' },
  success: { icon: 'check-circle-outline', title: '已完成' },
} as const;

export function InlineNotice({ message, title, tone = 'danger' }: InlineNoticeProps) {
  const { tones } = useAppTheme();
  const t = tones[tone];
  const meta = TONE_META[tone];
  return (
    <View
      accessibilityRole="alert"
      style={[styles.notice, { backgroundColor: t.bg, borderColor: `${t.fg}4D` }]}>
      <MaterialIcons
        name={meta.icon}
        size={20}
        color={t.fg}
      />
      <View style={styles.copy}>
        <Text style={[styles.title, { color: t.fg }]}>{title ?? meta.title}</Text>
        <Text style={[styles.message, { color: `${t.fg}D9` }]}>{readableMessage(message)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderWidth: 1,
    borderRadius: Radius.medium,
  },
  copy: {
    minWidth: 0,
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },
  message: {
    fontSize: 13,
    lineHeight: 19,
  },
});
