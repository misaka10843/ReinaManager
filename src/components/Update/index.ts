import { check, Update } from '@tauri-apps/plugin-updater';

export interface UpdateProgress {
  downloaded: number;
  contentLength: number;
  percentage: number;
}

export interface UpdateCallbacks {
  onUpdateFound?: (update: Update) => void;
  onProgress?: (progress: UpdateProgress) => void;
  onDownloadComplete?: () => void;
  onError?: (error: string) => void;
  onNoUpdate?: () => void;
}

const fetchChangelogFromGitHub = async (version: string): Promise<string | null> => {
  try {
    const response = await fetch(
      'https://cdn.akaere.online/https://raw.githubusercontent.com/huoshen80/ReinaManager/main/CHANGELOG.md'
    );
    
    if (!response.ok) {
      console.warn('Failed to fetch CHANGELOG.md from GitHub');
      return null;
    }
    
    const content = await response.text();
    return parseVersionChangelog(content, version);
  } catch (error) {
    console.warn('Error fetching CHANGELOG.md:', error);
    return null;
  }
};

// 解析特定版本的更新日志
const parseVersionChangelog = (content: string, version: string): string | null => {
  try {
    // 移除版本号前缀 'v' 如果存在
    const cleanVersion = version.replace(/^v/, '');
    
    // 查找版本标题的正则表达式
    const versionRegex = new RegExp(`## \\[${cleanVersion}\\].*?\\n`, 'i');
    const versionMatch = content.match(versionRegex);
    
    if (!versionMatch) {
      console.warn(`Version ${cleanVersion} not found in CHANGELOG.md`);
      return null;
    }
    
    const versionIndex = content.indexOf(versionMatch[0]);
    const contentAfterVersion = content.substring(versionIndex + versionMatch[0].length);
    
    // 查找下一个版本标题或文件结尾
    const nextVersionMatch = contentAfterVersion.match(/\n## \[.*?\]/);
    const changelogEnd = nextVersionMatch ? nextVersionMatch.index : contentAfterVersion.length;
    
    const versionChangelog = contentAfterVersion.substring(0, changelogEnd).trim();
    
    return versionChangelog;
  } catch (error) {
    console.error('Error parsing changelog:', error);
    return null;
  }
};

// 检查更新的主函数（默认集成 changelog）
export const checkForUpdates = async (callbacks?: UpdateCallbacks) => {
  try {
    const update = await check();
    console.log('Original update:', update);
    
    if (update) {
      // 尝试从 GitHub 获取详细更新日志
      const changelogContent = await fetchChangelogFromGitHub(update.version);
      
      // 如果获取到了更丰富的 changelog，则临时替换 body
      if (changelogContent) {
        // 创建一个代理对象，在访问 body 时返回增强的内容
        Object.defineProperty(update, 'body', {
          value: changelogContent,
          writable: true,
          configurable: true
        });
      }
      
      callbacks?.onUpdateFound?.(update);
      return update;
    } else {
      callbacks?.onNoUpdate?.();
      return null;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '检查更新失败';
    callbacks?.onError?.(errorMessage);
    return null;
  }
};

// 简单版本检查更新（不含 changelog 增强）
export const checkForUpdatesSimple = async (callbacks?: {
  onUpdateFound?: (update: Update) => void;
  onProgress?: (progress: UpdateProgress) => void;
  onDownloadComplete?: () => void;
  onError?: (error: string) => void;
  onNoUpdate?: () => void;
}) => {
  try {
    const update = await check();
    console.log(update);
    if (update) {  
      callbacks?.onUpdateFound?.(update);
      return update;
    } else {
      callbacks?.onNoUpdate?.();
      return null;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '检查更新失败';
    callbacks?.onError?.(errorMessage);
    return null;
  }
};

// 下载并安装更新
export const downloadAndInstallUpdate = async (
  update: Update, 
  callbacks?: UpdateCallbacks
) => {
  try {
    let downloaded = 0;
    let contentLength = 0;

    await update.downloadAndInstall((event) => {
      switch (event.event) {
        case 'Started':
          contentLength = event.data.contentLength || 0;
          break;
          
        case 'Progress':
          downloaded += event.data.chunkLength;
          const percentage = contentLength > 0 ? Math.round((downloaded / contentLength) * 100) : 0;
          
          callbacks?.onProgress?.({
            downloaded,
            contentLength,
            percentage
          });
          break;
          
        case 'Finished':
          callbacks?.onDownloadComplete?.();
          break;
      }
    });

    // 注意：在 Windows 上，应用会自动退出并重启
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '下载/安装更新失败';
    callbacks?.onError?.(errorMessage);
  }
};

// 完整的更新流程（检查 + 安装）
export const autoUpdate = async (callbacks?: UpdateCallbacks) => {
  const update = await checkForUpdates(callbacks);
  if (update) {
    await downloadAndInstallUpdate(update, callbacks);
  }
};

// 静默检查更新（应用启动时调用）
export const silentCheckForUpdates = async () => {
  try {
    // 开发环境下可能没有签名，先跳过检查
    if (import.meta.env.DEV) {
      return { hasUpdate: false };
    }
    
    const update = await check();
    if (update) {  
      // 可以存储到状态管理中，在适当时候提醒用户
      return {
        hasUpdate: true,
        version: update.version,
        body: update.body,
        date: update.date
      };
    }
    return { hasUpdate: false };
  } catch (error) {
    // 如果是签名相关错误，在开发环境下忽略
    if (error instanceof Error && error.message.includes('signature')) {
      console.warn('签名验证失败，可能是因为发布版本还未包含签名文件');
    }
    return { hasUpdate: false };
  }
};

export default checkForUpdates;
