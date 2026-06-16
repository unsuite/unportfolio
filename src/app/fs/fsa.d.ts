// Minimal File System Access API typings not yet in lib.dom
interface Window {
  showDirectoryPicker(options?: {
    mode?: "read" | "readwrite";
    id?: string;
    startIn?: "desktop" | "documents" | "downloads" | "music" | "pictures" | "videos";
  }): Promise<FileSystemDirectoryHandle>;
}

interface FileSystemHandle {
  queryPermission(descriptor?: { mode?: "read" | "readwrite" }): Promise<PermissionState>;
  requestPermission(descriptor?: { mode?: "read" | "readwrite" }): Promise<PermissionState>;
}
