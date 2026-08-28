// storage.js - Hybrid local + sync storage
// Uses chrome.storage.local as primary, syncs to chrome.storage.sync for cross-device access

const YTStorage = {
  // Sync quota: 100KB total, 8KB per item, 120 items max
  SYNC_MAX_ITEMS: 110,
  SYNC_MAX_ITEM_SIZE: 7000,

  get(key, callback) {
    chrome.storage.local.get(key, (localData) => {
      chrome.storage.sync.get(key, (syncData) => {
        // Merge: prefer local if both exist (local is more up-to-date)
        const result = {};
        const localVal = localData[key];
        const syncVal = syncData[key];

        if (localVal !== undefined && syncVal !== undefined) {
          // Both exist - use the higher value for numbers (most recent tracking)
          if (typeof localVal === 'number' && typeof syncVal === 'number') {
            result[key] = Math.max(localVal, syncVal);
          } else {
            result[key] = localVal;
          }
        } else {
          result[key] = localVal !== undefined ? localVal : syncVal;
        }
        callback(result);
      });
    });
  },

  set(data, callback) {
    // Always write to local
    chrome.storage.local.set(data, () => {
      // Also try to sync, but handle quota errors gracefully
      const syncData = {};
      let itemCount = 0;

      for (const [key, value] of Object.entries(data)) {
        const serialized = JSON.stringify(value);
        if (serialized.length <= this.SYNC_MAX_ITEM_SIZE) {
          syncData[key] = value;
          itemCount++;
        }
      }

      if (itemCount === 0) {
        callback && callback();
        return;
      }

      // Check current sync usage before writing
      chrome.storage.sync.get(null, (existing) => {
        const totalItems = Object.keys(existing).length + Object.keys(syncData).length;

        if (totalItems > this.SYNC_MAX_ITEMS) {
          // Too many items - only sync the most important data
          console.warn(`Sync quota: ${totalItems} items exceeds limit. Syncing summary only.`);
          this._syncSummary(data, callback);
          return;
        }

        chrome.storage.sync.set(syncData, () => {
          if (chrome.runtime.lastError) {
            console.warn('Sync write failed:', chrome.runtime.lastError.message);
          }
          callback && callback();
        });
      });
    });
  },

  _syncSummary(data, callback) {
    // For large datasets, sync only video IDs and seconds as a compact array
    const videos = [];
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'number' && key !== 'scraped_history') {
        videos.push([key, value]);
      }
    }

    if (videos.length === 0) {
      callback && callback();
      return;
    }

    // Sort by seconds descending, take top 100
    videos.sort((a, b) => b[1] - a[1]);
    const top = videos.slice(0, 100);

    chrome.storage.sync.set({ '_synced_videos': top }, () => {
      callback && callback();
    });
  },

  getAll(callback) {
    chrome.storage.local.get(null, (localData) => {
      chrome.storage.sync.get(null, (syncData) => {
        const merged = { ...syncData, ...localData };

        // Merge synced videos from summary if they exist locally
        if (syncData._synced_videos && Array.isArray(syncData._synced_videos)) {
          for (const [id, seconds] of syncData._synced_videos) {
            if (merged[id] === undefined) {
              merged[id] = seconds;
            } else if (typeof merged[id] === 'number') {
              merged[id] = Math.max(merged[id], seconds);
            }
          }
          delete merged._synced_videos;
        }

        callback(merged);
      });
    });
  },

  clear(callback) {
    chrome.storage.local.clear(() => {
      chrome.storage.sync.clear(() => {
        callback && callback();
      });
    });
  }
};
