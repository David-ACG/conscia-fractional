import { google } from "googleapis";
import { getValidAccessToken, createOAuth2Client } from "./google-auth-service";

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: number | null;
  modifiedTime: string;
  webViewLink: string;
  thumbnailLink: string | null;
  iconLink: string | null;
}

export interface DriveFolder {
  id: string;
  name: string;
  modifiedTime: string;
}

// Custom error classes
export class GoogleAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleAuthError";
  }
}

export class GoogleDriveNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleDriveNotFoundError";
  }
}

export class GoogleDrivePermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleDrivePermissionError";
  }
}

function mapGoogleError(err: unknown): never {
  const error = err as { code?: number; message?: string };
  const code = error?.code;
  const message = error?.message ?? String(err);

  if (code === 401)
    throw new GoogleAuthError(`Authentication failed: ${message}`);
  if (code === 404) throw new GoogleDriveNotFoundError(`Not found: ${message}`);
  if (code === 403)
    throw new GoogleDrivePermissionError(`Permission denied: ${message}`);

  throw new Error(`Google Drive API error: ${message}`);
}

export async function getAuthenticatedDriveClient(integrationId: string) {
  const accessToken = await getValidAccessToken(integrationId);
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({ access_token: accessToken });
  return google.drive({ version: "v3", auth: oauth2Client });
}

export async function listFiles(
  integrationId: string,
  folderId: string,
  pageToken?: string,
): Promise<{ files: DriveFile[]; nextPageToken: string | null }> {
  try {
    const drive = await getAuthenticatedDriveClient(integrationId);
    const response = await drive.files.list({
      q: `'${folderId}' in parents AND trashed = false AND mimeType != 'application/vnd.google-apps.folder'`,
      fields:
        "nextPageToken, files(id, name, mimeType, size, modifiedTime, webViewLink, thumbnailLink, iconLink)",
      orderBy: "modifiedTime desc",
      pageSize: 50,
      ...(pageToken ? { pageToken } : {}),
    });

    const files: DriveFile[] = (response.data.files ?? []).map((f) => ({
      id: f.id ?? "",
      name: f.name ?? "",
      mimeType: f.mimeType ?? "",
      size: f.size != null ? Number(f.size) : null,
      modifiedTime: f.modifiedTime ?? "",
      webViewLink: f.webViewLink ?? "",
      thumbnailLink: f.thumbnailLink ?? null,
      iconLink: f.iconLink ?? null,
    }));

    return {
      files,
      nextPageToken: response.data.nextPageToken ?? null,
    };
  } catch (err) {
    mapGoogleError(err);
  }
}

export async function listFolders(
  integrationId: string,
  parentId?: string,
): Promise<DriveFolder[]> {
  const parent = parentId || "root";
  try {
    const drive = await getAuthenticatedDriveClient(integrationId);
    const response = await drive.files.list({
      q: `'${parent}' in parents AND trashed = false AND mimeType = 'application/vnd.google-apps.folder'`,
      fields: "files(id, name, modifiedTime)",
      orderBy: "name asc",
    });

    return (response.data.files ?? []).map((f) => ({
      id: f.id ?? "",
      name: f.name ?? "",
      modifiedTime: f.modifiedTime ?? "",
    }));
  } catch (err) {
    mapGoogleError(err);
  }
}

export async function getFileMetadata(
  integrationId: string,
  fileId: string,
): Promise<DriveFile> {
  try {
    const drive = await getAuthenticatedDriveClient(integrationId);
    const response = await drive.files.get({
      fileId,
      fields:
        "id, name, mimeType, size, modifiedTime, webViewLink, thumbnailLink, iconLink",
    });

    const f = response.data;
    return {
      id: f.id ?? "",
      name: f.name ?? "",
      mimeType: f.mimeType ?? "",
      size: f.size != null ? Number(f.size) : null,
      modifiedTime: f.modifiedTime ?? "",
      webViewLink: f.webViewLink ?? "",
      thumbnailLink: f.thumbnailLink ?? null,
      iconLink: f.iconLink ?? null,
    };
  } catch (err) {
    mapGoogleError(err);
  }
}

export async function getFolderMetadata(
  integrationId: string,
  folderId: string,
): Promise<{ id: string; name: string; parents: string[] }> {
  try {
    const drive = await getAuthenticatedDriveClient(integrationId);
    const response = await drive.files.get({
      fileId: folderId,
      fields: "id, name, parents",
    });

    const f = response.data;
    return {
      id: f.id ?? "",
      name: f.name ?? "",
      parents: f.parents ?? [],
    };
  } catch (err) {
    mapGoogleError(err);
  }
}
