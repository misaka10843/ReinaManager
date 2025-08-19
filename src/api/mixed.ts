/**
 * @file 混合数据获取 API 封装
 * @description 同时从 Bangumi 和 VNDB 获取游戏信息并合并数据
 * @module src/api/mixed
 * @author ReinaManager
 * @copyright AGPL-3.0
 *  * 逻辑说明：
 * 1. 根据传入的 ID 类型智能选择获取策略：
 *    - 只有 BGM ID：先获取 BGM 数据，再用其名称搜索 VNDB
 *    - 只有 VNDB ID：先获取 VNDB 数据，再用其名称搜索 BGM  
 *    - 两个 ID 都有：并行获取两个数据源
 *    - 没有 ID：用名称搜索，优先 BGM，失败则尝试 VNDB
 * 2. 使用安全模式避免单个数据源失败导致整体失败
 * 3. 合并数据时以 BGM 数据为主，VNDB 数据为补充
 * 4. 确保至少有一个数据源成功才返回结果
 * 
 * 主要导出：
 * - fetchMixedData：混合获取游戏数据的主函数
 */

import { fetchFromBgm } from "./bgm";
import { fetchFromVNDB } from "./vndb";
import type { GameData } from "../types";
import i18n from '@/utils/i18n';

const fetchMixedData = async (
  name: string, 
  BGM_TOKEN: string, 
  bgm_id?: string, 
  vndb_id?: string
): Promise<GameData | string> => {
  try {
    let BGMdata: GameData | null = null;
    let VNDBdata: GameData | null = null;
    
    // 根据传入的ID类型决定获取策略
    if (bgm_id && !vndb_id) {
      // 只有 Bangumi ID：先获取 BGM 数据，再用 BGM 名称搜索 VNDB
      BGMdata = await getBangumiData(name, BGM_TOKEN, bgm_id);
      VNDBdata = await getVNDBDataSafely(BGMdata.name);
    } else if (vndb_id && !bgm_id) {
      // 只有 VNDB ID：先获取 VNDB 数据，再用 VNDB 名称搜索 BGM
      VNDBdata = await getVNDBData(name, vndb_id);
      BGMdata = await getBangumiDataSafely(VNDBdata.name, BGM_TOKEN);
    } else if (bgm_id && vndb_id) {
      // 有两个 ID：直接分别获取
      const [bgmResult, vndbResult] = await Promise.allSettled([
        getBangumiData(name, BGM_TOKEN, bgm_id),
        getVNDBData(name, vndb_id)
      ]);
      
      if (bgmResult.status === 'fulfilled') BGMdata = bgmResult.value;
      if (vndbResult.status === 'fulfilled') VNDBdata = vndbResult.value;
    } else {
      // 没有 ID：用名称搜索，优先 BGM
      BGMdata = await getBangumiDataSafely(name, BGM_TOKEN);
      if (BGMdata) {
        VNDBdata = await getVNDBDataSafely(BGMdata.name);
      } else {
        // 如果 BGM 搜索失败，尝试 VNDB
        VNDBdata = await getVNDBDataSafely(name);
      }
    }
    
    // 确保至少有一个数据源成功
    if (!BGMdata && !VNDBdata) {
      throw new Error(i18n.t('api.mixed.noDataSource', '无法从任何数据源获取游戏信息'));
    }
    
    // 合并数据
    return mergeData(BGMdata, VNDBdata);
    
  } catch (error) {
    console.error("Mixed API 调用失败:", error instanceof Error ? error.message : error);
    return i18n.t('api.mixed.fetchError', '获取数据失败，请稍后重试');
  }
};

// 辅助函数：获取Bangumi数据（严格模式，失败时抛出异常）
async function getBangumiData(name: string, BGM_TOKEN: string, bgm_id?: string): Promise<GameData> {
  const BGMdata = await fetchFromBgm(name, BGM_TOKEN, bgm_id);
  
  if (!BGMdata || typeof BGMdata === "string") {
    throw new Error(`${i18n.t('api.mixed.bgmFetchFailed', 'Bangumi 数据获取失败')}: ${BGMdata}`);
  }
  
  return BGMdata;
}

// 辅助函数：获取Bangumi数据（安全模式，失败时返回null）
async function getBangumiDataSafely(name: string, BGM_TOKEN: string, bgm_id?: string): Promise<GameData | null> {
  try {
    return await getBangumiData(name, BGM_TOKEN, bgm_id);
  } catch {
    return null;
  }
}

// 辅助函数：获取VNDB数据（严格模式，失败时抛出异常）
async function getVNDBData(searchName: string, vndb_id?: string): Promise<GameData> {
  const VNDBdata = await fetchFromVNDB(searchName, vndb_id);
  
  if (!VNDBdata || typeof VNDBdata === "string") {
    throw new Error(`${i18n.t('api.mixed.vndbFetchFailed', 'VNDB 数据获取失败')}: ${VNDBdata}`);
  }
  
  return VNDBdata;
}

// 辅助函数：获取VNDB数据（安全模式，失败时返回null）
async function getVNDBDataSafely(searchName: string, vndb_id?: string): Promise<GameData | null> {
  try {
    return await getVNDBData(searchName, vndb_id);
  } catch {
    return null;
  }
}

// 辅助函数：合并数据
function mergeData(BGMdata: GameData | null, VNDBdata: GameData | null): GameData {
  // 如果只有一个数据源，直接返回
  if (!BGMdata && VNDBdata) return VNDBdata;
  if (BGMdata && !VNDBdata) return BGMdata;
  if (!BGMdata && !VNDBdata) {
    throw new Error(i18n.t('api.mixed.noDataForMerge', '没有可用的数据进行合并'));
  }
  
  // 两个数据源都有，进行合并（BGM 数据优先）
  return {
    bgm_id: BGMdata?.bgm_id || null,
    vndb_id: VNDBdata?.vndb_id || null,
    id_type: "mixed",
    date: BGMdata?.date || VNDBdata?.date,
    image: BGMdata?.image || VNDBdata?.image,
    summary: BGMdata?.summary || VNDBdata?.summary,
    name: BGMdata?.name || VNDBdata?.name || '',
    name_cn: BGMdata?.name_cn || VNDBdata?.name_cn,
    all_titles: VNDBdata?.all_titles || BGMdata?.all_titles || [],
    tags: BGMdata?.tags || VNDBdata?.tags,
    rank: BGMdata?.rank || undefined,
    score: BGMdata?.score || VNDBdata?.score,
    developer: BGMdata?.developer || VNDBdata?.developer,
    aveage_hours: VNDBdata?.aveage_hours || undefined,  
  };
}

export default fetchMixedData;