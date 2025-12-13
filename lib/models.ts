export type User = {
  id: number;
  username: string;
  displayName?: string;
  email?: string;
  role?: number;
  status?: number;
  group?: string;
  quota?: number;
  usedQuota?: number;
  requestCount?: number;
};

export type Token = {
  id: number;
  name?: string;
  key?: string;
  status?: number;
  group?: string;
  createdTime?: number;
  accessedTime?: number;
  expiredTime?: number;
  remainQuota?: number;
  usedQuota?: number;
  unlimitedQuota?: boolean;
  modelLimitsEnabled?: boolean;
  modelLimits?: string;
  allowIps?: string | null;
  crossGroupRetry?: boolean;
};

export type LogItem = {
  id: number;
  type?: number;
  content?: string;
  createdAt?: number;
  username?: string;
  tokenName?: string;
  modelName?: string;
  quota?: number;
  promptTokens?: number;
  completionTokens?: number;
  useTime?: number;
  isStream?: boolean;
  channel?: number;
  tokenId?: number;
  group?: string;
  ip?: string;
  other?: string;
};

export type QuotaData = {
  id?: number;
  userId?: number;
  username?: string;
  modelName?: string;
  createdAt?: number;
  tokenUsed?: number;
  count?: number;
  quota?: number;
};

export type PayMethod = {
  name: string;
  type: string;
  color?: string;
  minTopup?: number;
};

export type CreemProduct = {
  productId: string;
  name: string;
  price: number;
  currency?: string;
  quota?: number;
};

export type TopupInfo = {
  enableOnlineTopup: boolean;
  enableStripeTopup: boolean;
  enableCreemTopup: boolean;
  minTopup?: number;
  stripeMinTopup?: number;
  payMethods: PayMethod[];
  amountOptions: number[];
  discount: Record<string, number>;
  creemProducts: CreemProduct[];
};

export type Redemption = {
  id: number;
  userId?: number;
  key?: string;
  status?: number;
  name?: string;
  quota?: number;
  createdTime?: number;
  redeemedTime?: number;
  usedUserId?: number;
  expiredTime?: number;
};

export type Channel = {
  id: number;
  type?: number;
  status?: number;
  name?: string;
  group?: string;
  tag?: string;
  baseUrl?: string;
  models?: string;
  priority?: number;
  weight?: number;
  createdTime?: number;
  responseTime?: number;
  balance?: number;
  other?: string;
  remark?: string;
};
