import type { PathWatcherEvent, WebContainer } from '@webcontainer/api';
import { getEncoding } from 'istextorbinary';
import { map, type MapStore } from 'nanostores';
import { Buffer } from 'node:buffer';
import * as nodePath from 'node:path';
import { bufferWatchEvents } from '~/utils/buffer';
import { WORK_DIR } from '~/utils/constants';
import { computeFileModifications } from '~/utils/diff';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('FilesStore');
const utf8TextDecoder = new TextDecoder('utf8', { fatal: true });

const BATCH_WRITE_DELAY = 100; // ms
const MAX_BATCH_SIZE = 1000; // files
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export interface File {
  type: 'file';
  content: string;
  isBinary: boolean;
  metadata: {
    lastModified: number;
    size: number;
  };
}

export interface Folder {
  type: 'folder';
}

type Dirent = File | Folder;
export type FileMap = Record<string, Dirent | undefined>;

export class FilesStoreError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message);
    this.name = 'FilesStoreError';
  }
}

export class FilesStore {
  readonly #webcontainer: Promise<WebContainer>;
  #size = 0;
  #modifiedFiles: Map<string, string> = import.meta.hot?.data.modifiedFiles ?? new Map();
  files: MapStore<FileMap> = import.meta.hot?.data.files ?? map({});
  
  // Enhanced cache with metadata
  #fileCache: Map<string, {
    content: string;
    lastModified: number;
    size: number;
    hash?: string;
  }> = new Map();
  
  #pendingWrites: Map<string, string> = new Map();
  #writeDebounceTimer: NodeJS.Timeout | null = null;
  #isWriting = false;

  constructor(webcontainerPromise: Promise<WebContainer>) {
    this.#webcontainer = webcontainerPromise;

    if (import.meta.hot) {
      import.meta.hot.data.files = this.files;
      import.meta.hot.data.modifiedFiles = this.#modifiedFiles;
    }

    this.#init();
  }

  get filesCount() {
    return this.#size;
  }

  get pendingWritesCount() {
    return this.#pendingWrites.size;
  }

  async getFile(filePath: string): Promise<File | undefined> {
    const dirent = this.files.get()[filePath];
    if (dirent?.type !== 'file') {
      return undefined;
    }

    // Try to get from cache first
    const cached = this.#fileCache.get(filePath);
    if (cached) {
      return {
        type: 'file',
        content: cached.content,
        isBinary: false,
        metadata: {
          lastModified: cached.lastModified,
          size: cached.size
        }
      };
    }

    return dirent;
  }

  getFileModifications() {
    return computeFileModifications(this.files.get(), this.#modifiedFiles);
  }

  resetFileModifications() {
    this.#modifiedFiles.clear();
  }

  async saveFile(filePath: string, content: string): Promise<void> {
    try {
      const webcontainer = await this.#webcontainer;
      const relativePath = nodePath.relative(webcontainer.workdir, filePath);

      if (!relativePath) {
        throw new FilesStoreError(`Invalid file path: ${filePath}`);
      }

      // Size validation
      const size = Buffer.byteLength(content);
      if (size > MAX_FILE_SIZE) {
        throw new FilesStoreError(`File size ${size} exceeds maximum allowed size of ${MAX_FILE_SIZE} bytes`);
      }

      // Check cache for unchanged content
      const cached = this.#fileCache.get(filePath);
      if (cached?.content === content) {
        logger.debug('File content unchanged, skipping write:', filePath);
        return;
      }

      // Update cache immediately
      this.#fileCache.set(filePath, {
        content,
        lastModified: Date.now(),
        size,
      });

      // Add to pending writes
      this.#pendingWrites.set(filePath, content);

      // Update files store immediately for UI responsiveness
      this.files.setKey(filePath, {
        type: 'file',
        content,
        isBinary: false,
        metadata: {
          lastModified: Date.now(),
          size
        }
      });

      // Track original content for modifications only if it's not already tracked
      if (!this.#modifiedFiles.has(filePath)) {
        const oldContent = (await this.getFile(filePath))?.content;
        if (oldContent !== undefined) {
          this.#modifiedFiles.set(filePath, oldContent);
        }
      }

      // Schedule batch write
      this.#scheduleBatchWrite();

    } catch (error) {
      logger.error('Failed to save file:', filePath, error);
      throw error;
    }
  }

  async #init() {
    const webcontainer = await this.#webcontainer;
    webcontainer.internal.watchPaths(
      {
        include: [`${WORK_DIR}/**`],
        exclude: ['**/node_modules', '.git'],
        includeContent: true
      },
      bufferWatchEvents(100, this.#processEventBuffer.bind(this)),
    );
  }

  #scheduleBatchWrite() {
    if (this.#writeDebounceTimer) {
      clearTimeout(this.#writeDebounceTimer);
    }

    // If we have too many pending writes, process immediately
    if (this.#pendingWrites.size >= MAX_BATCH_SIZE) {
      this.#processBatchWrite();
    } else {
      this.#writeDebounceTimer = setTimeout(() => this.#processBatchWrite(), BATCH_WRITE_DELAY);
    }
  }

  async #processBatchWrite() {
    if (this.#isWriting || this.#pendingWrites.size === 0) {
      return;
    }

    this.#isWriting = true;
    const webcontainer = await this.#webcontainer;
    const writes = Array.from(this.#pendingWrites.entries());
    this.#pendingWrites.clear();

    try {
      await Promise.all(
        writes.map(async ([filePath, content]) => {
          const relativePath = nodePath.relative(webcontainer.workdir, filePath);
          try {
            await webcontainer.fs.writeFile(relativePath, content);
            logger.debug('File written successfully:', filePath);
          } catch (error) {
            logger.error('Failed to write file:', filePath, error);
            // Re-queue failed writes
            this.#pendingWrites.set(filePath, content);
          }
        })
      );
    } finally {
      this.#isWriting = false;
      // Process any writes that were added during this batch
      if (this.#pendingWrites.size > 0) {
        this.#scheduleBatchWrite();
      }
    }
  }

  #processEventBuffer(events: Array<[events: PathWatcherEvent[]]>) {
    const watchEvents = events.flat(2);

    for (const { type, path, buffer } of watchEvents) {
      const sanitizedPath = this.#sanitizePath(path);

      switch (type) {
        case 'add_dir':
          this.files.setKey(sanitizedPath, { type: 'folder' });
          break;

        case 'remove_dir':
          this.#removeDirectory(sanitizedPath);
          break;

        case 'add_file':
        case 'change':
          this.#handleFileChange(type, sanitizedPath, buffer);
          break;

        case 'remove_file':
          this.#removeFile(sanitizedPath);
          break;
      }
    }
  }

  #removeDirectory(path: string) {
    this.files.setKey(path, undefined);
    for (const [direntPath] of Object.entries(this.files.get())) {
      if (direntPath.startsWith(path)) {
        this.files.setKey(direntPath, undefined);
        this.#fileCache.delete(direntPath);
      }
    }
  }

  #handleFileChange(type: 'add_file' | 'change', path: string, buffer?: Uint8Array) {
    if (type === 'add_file') {
      this.#size++;
    }

    const isBinary = this.#isBinaryFile(buffer);
    const content = isBinary ? '' : this.#decodeFileContent(buffer);
    const size = buffer?.byteLength ?? 0;

    this.files.setKey(path, {
      type: 'file',
      content,
      isBinary,
      metadata: {
        lastModified: Date.now(),
        size
      }
    });

    // Update cache
    if (!isBinary) {
      this.#fileCache.set(path, {
        content,
        lastModified: Date.now(),
        size
      });
    }
  }

  #removeFile(path: string) {
    this.#size--;
    this.files.setKey(path, undefined);
    this.#fileCache.delete(path);
    this.#pendingWrites.delete(path);
  }

  #decodeFileContent(buffer?: Uint8Array): string {
    if (!buffer || buffer.byteLength === 0) {
      return '';
    }

    try {
      return utf8TextDecoder.decode(buffer);
    } catch (error) {
      logger.error('Failed to decode file content:', error);
      return '';
    }
  }

  #sanitizePath(path: string): string {
    return path.replace(/\/+$/g, '');
  }

  #isBinaryFile(buffer: Uint8Array | undefined): boolean {
    if (!buffer) return false;
    return getEncoding(this.#convertToBuffer(buffer), { chunkLength: 100 }) === 'binary';
  }

  #convertToBuffer(view: Uint8Array): Buffer {
    const buffer = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
    Object.setPrototypeOf(buffer, Buffer.prototype);
    return buffer as Buffer;
  }
}