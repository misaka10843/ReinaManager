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

import http from './http'

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
 * @param {string} name 游戏名称，用于搜索 Bangumi 条目。
 * @param {string} BGM_TOKEN Bangumi API 访问令牌。
 * @param {string} [id] （可选）Bangumi 条目 ID，若未提供则根据名称搜索。
 * @returns {Promise<object | string>} 包含游戏详细信息的对象，若未找到则返回错误提示字符串。
 */
export async function fetchFromBgm(
  name: string,
  BGM_TOKEN: string,
  id?: string
) {
  const BGM_HEADER = {
    headers: {
      "Authorization": `Bearer ${BGM_TOKEN}`,
    }
  };
  let idTemp = id;
  if (!id) {
    const dataTemp = (await http.get(
      `https://api.bgm.tv/search/subject/${name}?type=4&responseGroup=small`
    )).data;
    if (!dataTemp || dataTemp.length === 0)
      return "未找到相关条目，请确认游戏名字后重试";
    idTemp = dataTemp.list[0].id;
  }
  const BGMdata = (await http.get(
    `https://api.bgm.tv/v0/subjects/${idTemp}`,
    BGM_TOKEN !== '' ? BGM_HEADER : undefined
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
  }
}

