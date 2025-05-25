import { fetchFromBgm } from "./bgm";
import { fetchFromVNDB } from "./vndb";

const fetchMixedData = async (name: string, BGM_TOKEN: string, bgm_id?: string, vndb_id?: string) => {
  try {
    let BGMdata = null;
    let VNDBdata = null;

    if (bgm_id) {
      BGMdata = await fetchFromBgm(name, BGM_TOKEN, bgm_id);
    } else {
      BGMdata = await fetchFromBgm(name, BGM_TOKEN);
    }

    if (!BGMdata || typeof BGMdata === "string") {
        throw new Error(`Bangumi 数据获取失败: ${BGMdata}`);
    }
    
    if (vndb_id) {
      VNDBdata = await fetchFromVNDB(BGMdata.name, vndb_id);
    } else {
      VNDBdata = await fetchFromVNDB(BGMdata.name);
    }

    if (!VNDBdata || typeof VNDBdata === "string") {
      throw new Error(`VNDB 数据获取失败: ${VNDBdata}`);
    }

    return {
      bgm_id: BGMdata.bgm_id,
      vndb_id: VNDBdata.vndb_id,
      id_type: "mixed",
      date: BGMdata.date || VNDBdata.date,
      image: BGMdata.image || VNDBdata.image,
      summary: BGMdata.summary || VNDBdata.summary,
      name: BGMdata.name || VNDBdata.name,
      name_cn: BGMdata.name_cn || VNDBdata.name_cn,
      all_titles: VNDBdata.all_titles || [],
      tags: BGMdata.tags || VNDBdata.tags,
      rank: BGMdata.rank || undefined,
      score: BGMdata.score || VNDBdata.score,
      developer: BGMdata.developer || VNDBdata.developer,
      aveage_hours: VNDBdata.aveage_hours || undefined,
    };
  } catch (error) {
    Promise.reject(new Error("Mixed API 调用失败"));
 if (error instanceof Error) {
   console.error("错误消息:", error.message);
 }
 return "获取数据失败，请稍后重试";
}
};

export default fetchMixedData;