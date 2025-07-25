import { enable, isEnabled, disable } from '@tauri-apps/plugin-autostart';


export const toggleAutostart = async () => {
  try {
    // 检查当前是否已启用 autostart
    const enabled = await isEnabled();
    if (enabled) {
      // 如果已启用，则禁用 autostart
       disable();
        console.log('Autostart disabled');
    } else {
      // 如果未启用，则启用 autostart
      await enable();
      console.log('Autostart enabled');
    }
  } catch (error) {
    console.error('Error toggling autostart:', error);
  }
};
