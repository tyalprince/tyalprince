// Shapes the Files API returns to the browser.

export type DriveItem = {
  id: string;
  parentId: string | null;
  kind: "folder" | "file";
  name: string;
  size: number;
  contentType: string | null;
  hasThumbnail: boolean;
  starred: boolean;
  trashedAt: string | null;
  /** View-only link token (/s/<token>), if shared. */
  shareToken: string | null;
  shareExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Folders only: how many items are inside (not in the bin). */
  childCount?: number;
  /** Search, recent, starred and shared views: the folder it's in. */
  path?: string;
};

export type DriveView = "files" | "recent" | "starred" | "shared" | "photos" | "trash";

export type Usage = {
  totalBytes: number;
  fileCount: number;
  folderCount: number;
  trashBytes: number;
  byCategory: { category: string; bytes: number; count: number }[];
};

export const contentUrl = (id: string, opts: { download?: boolean } = {}) =>
  `/api/files/${id}/content${opts.download ? "?download=1" : ""}`;
export const thumbnailUrl = (id: string) => `/api/files/${id}/content?thumb=1`;
