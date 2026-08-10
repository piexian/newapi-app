import React from 'react';

import { AppButton } from '@/components/ui/app-button';

export function FloatingRefreshButton({
  onPress,
  disabled,
  loading,
  label,
}: {
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  label?: string;
}) {
  return (
    <AppButton
      label={label ?? '刷新'}
      icon="refresh"
      variant="secondary"
      compact
      loading={loading}
      disabled={disabled}
      onPress={onPress}
    />
  );
}
