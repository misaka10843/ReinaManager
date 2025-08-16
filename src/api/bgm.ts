/**
 * @file Bangumi 游戏信息 API 封装
 * @description 提供与 Bangumi API 交互的函数，包括通过名称或 ID 获取游戏条目，并对标签进行敏感词过滤。
 * @module src/api/bgm
 * @author ReinaManager
 * @copyright AGPL-3.0
 *
 * 主要导出：
 * - fetchFromBgm：根据游戏名称或 Bangumi ID 获取游戏详细信息，自动过滤敏感标签。
 *
 * 依赖：
 * - http: 封装的 HTTP 请求工具
 * - time_now: 获取当前时间的工具函数
 */

import { tauriHttp } from './http'
import pkg from '../../package.json'

/**
 * 过滤掉包含敏感关键词的标签。
 *
 * @param tags 标签字符串数组。
 * @returns 过滤后的标签字符串数组，不包含敏感词。
 */
function filterSensitiveTags(tags: string[]): string[] {
  const sensitiveKeywords = [
    '台独', '港独', '藏独', '分裂', '反华', '辱华', 
  ];
  return tags.filter(tag => {
    return !sensitiveKeywords.some(keyword => tag.includes(keyword));
  });
}

/**
 * 根据游戏名称或 Bangumi ID 获取 Bangumi 游戏条目信息，并过滤敏感标签。
 *
 * 该函数会根据传入的游戏名称或 Bangumi 条目 ID，调用 Bangumi API 获取游戏详细信息。
 * 若未提供 ID，则优先通过名称搜索条目。获取到条目后，会对标签进行敏感词过滤，最终返回结构化的游戏信息对象。
 * 若未找到条目，则返回错误提示字符串。
 *
 * 主要导出：
 * - fetchFromBgm：根据游戏名称或 Bangumi ID 获取游戏详细信息，自动过滤敏感标签。
 *
 * 依赖：
 * - http: 封装的 HTTP 请求工具
 * - time_now: 获取当前时间的工具函数
 */

/**
 * 通过 ID 获取 Bangumi 游戏条目的详细信息。
 *
 * @param {string} id Bangumi 条目 ID
 * @param {string} BGM_TOKEN Bangumi API 访问令牌
 * @returns {Promise<object>} 包含游戏详细信息的对象
 */
/**
 * 通用 Bangumi 游戏信息获取函数
 * 
 * 根据是否传入 ID 参数自动选择使用的 API：
 * - 传入 ID：使用 GET /v0/subjects/{id} 接口
 * - 不传入 ID：使用 POST /v0/search/subjects 接口进行关键词搜索
 *
 * @param {string} nameOrId 游戏名称（用于搜索）或 Bangumi ID（用于直接获取）
 * @param {string} BGM_TOKEN Bangumi API 访问令牌
 * @param {string} [id] （可选）Bangumi 条目 ID，若提供则直接通过 ID 获取详情
 */
export async function fetchFromBgm(
  nameOrId: string,
  BGM_TOKEN: string,
  id?: string
) {
  // 使用 Tauri HTTP 客户端，支持自定义 User-Agent
  const BGM_HEADER = {
        headers: {
          'Accept': 'application/json',
          'User-Agent': `huoshen80/ReinaManager/${pkg.version} (https://github.com/huoshen80/ReinaManager)`,
          ...(BGM_TOKEN ? { Authorization: `Bearer ${BGM_TOKEN}` } : {}),
        },
      };

  // 如果提供了 ID，使用 ID 获取接口
  if (id) {
    const BGMdata = (await tauriHttp.get(
      `https://api.bgm.tv/v0/subjects/${id}`,
      BGM_HEADER
    )).data;

    return {
      date: BGMdata.date,
      image: BGMdata.images.large,
      summary: BGMdata.summary,
      name: BGMdata.name,
      name_cn: BGMdata.name_cn,
      tags: filterSensitiveTags(
        BGMdata.tags?.map((tag: { name: string }) => tag.name) || []
      ),
      rank: BGMdata.rating.rank,
      score: BGMdata.rating.score,
      bgm_id: String(BGMdata.id),
      vndb_id: null,
      id_type: 'bgm',
      developer: BGMdata.infobox.find((k: { key: string }) => k.key === '开发')?.value ?? '',
    };
  }

  // 如果没有提供 ID，使用关键词搜索接口
  const keyword = nameOrId.trim();
  const resp = (await tauriHttp.post(
    'https://api.bgm.tv/v0/search/subjects',
    {
      "keyword": keyword,
      "filter": {
        "type": [4] // 4 = 游戏类型
      }
    },
    BGM_HEADER
  )).data;
  const BGMdata = Array.isArray(resp.data) ? resp.data[0] : undefined;

  if (!BGMdata?.id) {
    return "未找到相关条目，请确认游戏名字后重试，或未设置BGM_TOKEN";
  }

  // 直接从搜索结果构建返回对象
  return {
      date: BGMdata.date,
      image: BGMdata.images.large,
      summary: BGMdata.summary,
      name: BGMdata.name,
      name_cn: BGMdata.name_cn,
      tags: filterSensitiveTags(
        BGMdata.tags?.map((tag: { name: string }) => tag.name) || []
      ),
      rank: BGMdata.rating.rank,
      score: BGMdata.rating.score,
      bgm_id: String(BGMdata.id),
      vndb_id: null,
      id_type: 'bgm',
      developer: BGMdata.infobox.find((k: { key: string }) => k.key === '开发')?.value ?? '',
    };
}

