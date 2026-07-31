import React from 'react';

import { AppButton } from '@/components/ui/app-button';

export function FloatingRefreshButton({
  onPress,
  disabled,
  label,
}: {
  onPress: () => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <AppButton
      label={label ?? '刷新'}
      icon="refresh"
      variant="secondary"
      compact
      loading={disabled}
      onPress={onPress}
    />
  );
}
