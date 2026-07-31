import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { StyleSheet, Text, View } from 'react-native';

import { Palette, Radius } from '@/constants/theme';

type InlineNoticeProps = {
  message: string;
  title?: string;
};

function readableMessage(message: string) {
  if (/failed to fetch|network request failed/i.test(message)) {
    return '无法连接服务器，请检查地址或网络后重试。';
  }
  return message;
}

export function InlineNotice({ message, title = '请求失败' }: InlineNoticeProps) {
  return (
    <View accessibilityRole="alert" style={styles.notice}>
      <MaterialIcons name="error-outline" size={20} color={Palette.danger} />
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{readableMessage(message)}</Text>
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
    borderColor: '#F2B8B5',
    borderRadius: Radius.medium,
    backgroundColor: Palette.dangerSoft,
  },
  copy: {
    minWidth: 0,
    flex: 1,
    gap: 2,
  },
  title: {
    color: Palette.danger,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },
  message: {
    color: '#7A271A',
    fontSize: 13,
    lineHeight: 19,
  },
});
