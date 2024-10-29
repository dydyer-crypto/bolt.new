import { useStore } from '@nanostores/react';
import { useState } from 'react';
import { versionHistoryStore } from '~/lib/stores/version-history';

interface VersionHistoryProps {
  filePath: string;
}

export function VersionHistory({ filePath }: VersionHistoryProps) {
  const [isReverting, setIsReverting] = useState(false);
  const versions = versionHistoryStore.getVersions(filePath);
  const currentVersion = versionHistoryStore.getCurrentVersion(filePath);

  if (!versions.length) {
    return null;
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const handleRevert = async (versionIndex: number) => {
    try {
      setIsReverting(true);
      await versionHistoryStore.revertToVersion(filePath, versionIndex);
    } catch (error) {
      console.error('Failed to revert file:', error);
    } finally {
      setIsReverting(false);
    }
  };

  return (
    <div className="version-history p-4 bg-bolt-elements-background-depth-1">
      <h3 className="text-lg font-semibold mb-4">Version History</h3>
      <div className="version-list space-y-3 max-h-[300px] overflow-y-auto">
        {versions.map((version, index) => (
          <div
            key={version.timestamp}
            className={`version-item p-3 rounded-lg ${
              currentVersion && currentVersion.timestamp === version.timestamp
                ? 'bg-bolt-elements-background-depth-3 border-l-2 border-bolt-elements-borderColor-active'
                : 'bg-bolt-elements-background-depth-2'
            }`}
          >
            <div className="version-info space-y-1">
              <div className="flex justify-between items-center">
                <span className="font-medium">Version {versions.length - index}</span>
                <span className="text-sm text-bolt-elements-textSecondary">
                  {formatDate(version.timestamp)}
                </span>
              </div>
              <p className="text-sm text-bolt-elements-textSecondary">{version.description}</p>
            </div>
            {currentVersion && currentVersion.timestamp !== version.timestamp && (
              <button
                onClick={() => handleRevert(index)}
                className="mt-2 w-full px-3 py-1.5 text-sm bg-bolt-elements-background-depth-3 text-bolt-elements-textPrimary rounded hover:bg-bolt-elements-background-depth-4 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                disabled={isReverting}
              >
                {isReverting ? 'Reverting...' : 'Revert to this version'}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
