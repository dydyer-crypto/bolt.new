import { map, type MapStore } from 'nanostores';
import { createScopedLogger } from '~/utils/logger';
import type { FilesStore } from './files';

const logger = createScopedLogger('VersionHistoryStore');

export interface FileVersion {
  content: string;
  timestamp: number;
  description: string;
}

export interface FileHistory {
  versions: FileVersion[];
  currentVersion: number;
}

type VersionMap = Record<string, FileHistory | undefined>;

export class VersionHistoryStore {
  versions: MapStore<VersionMap> = map({});
  #filesStore?: FilesStore;

  setFilesStore(filesStore: FilesStore) {
    this.#filesStore = filesStore;
  }

  addVersion(filePath: string, content: string, description: string) {
    const currentHistory = this.versions.get()[filePath] || { versions: [], currentVersion: -1 };
    
    // Don't add duplicate versions with the same content
    const lastVersion = currentHistory.versions[currentHistory.versions.length - 1];
    if (lastVersion && lastVersion.content === content) {
      return;
    }

    const newVersion: FileVersion = {
      content,
      timestamp: Date.now(),
      description
    };

    const newHistory: FileHistory = {
      versions: [...currentHistory.versions, newVersion],
      currentVersion: currentHistory.versions.length
    };

    this.versions.setKey(filePath, newHistory);
    logger.info(`Added version for ${filePath}: ${description}`);
  }

  getVersions(filePath: string): FileVersion[] {
    const history = this.versions.get()[filePath];
    if (!history) {
      // If no history exists, create initial version from current file content
      if (this.#filesStore) {
        const file = this.#filesStore.getFile(filePath);
        if (file) {
          this.addVersion(filePath, file.content, 'Initial version');
          return this.versions.get()[filePath]?.versions || [];
        }
      }
      return [];
    }
    return history.versions;
  }

  getCurrentVersion(filePath: string): FileVersion | undefined {
    const history = this.versions.get()[filePath];
    if (!history) {
      // If no history exists, create initial version from current file content
      if (this.#filesStore) {
        const file = this.#filesStore.getFile(filePath);
        if (file) {
          this.addVersion(filePath, file.content, 'Initial version');
          return this.versions.get()[filePath]?.versions[0];
        }
      }
      return undefined;
    }
    return history.versions[history.currentVersion];
  }

  getVersion(filePath: string, versionIndex: number): FileVersion | undefined {
    return this.versions.get()[filePath]?.versions[versionIndex];
  }

  async revertToVersion(filePath: string, versionIndex: number): Promise<FileVersion | undefined> {
    const history = this.versions.get()[filePath];
    if (!history || versionIndex < 0 || versionIndex >= history.versions.length) {
      return undefined;
    }

    const version = history.versions[versionIndex];
    if (!version) {
      return undefined;
    }

    // Update the file content using FilesStore
    if (this.#filesStore) {
      try {
        await this.#filesStore.saveFile(filePath, version.content, `Reverted to version ${versionIndex + 1}`);
        
        const newHistory: FileHistory = {
          ...history,
          currentVersion: versionIndex
        };

        this.versions.setKey(filePath, newHistory);
        logger.info(`Reverted ${filePath} to version ${versionIndex + 1}`);
        return version;
      } catch (error) {
        logger.error(`Failed to revert ${filePath} to version ${versionIndex + 1}:`, error);
        throw error;
      }
    } else {
      logger.error('FilesStore not initialized');
      throw new Error('FilesStore not initialized');
    }
  }
}

export const versionHistoryStore = new VersionHistoryStore();
