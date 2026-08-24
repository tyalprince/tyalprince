export type VaultEntryRow = {
  id: string;
  userId: string;
  siteName: string;
  siteUrl: string | null;
  category: string | null;
  encryptedBlob: string;
  iv: string;
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string | null;
};

export type VaultEntrySecret = {
  username: string;
  password: string;
  notes: string;
};

/** A vault entry with its secret fields decrypted in-memory (never persisted). */
export type DecryptedVaultEntry = VaultEntryRow & {
  secret: VaultEntrySecret;
};

export type VaultSettingsRow = {
  userId: string;
  kdfSalt: string;
  kdfIterations: number;
  verifierBlob: string;
  verifierIv: string;
  createdAt: string;
};

export type VaultCategoryRow = {
  id: string;
  userId: string;
  name: string;
  createdAt: string;
};
