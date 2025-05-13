/**
 * @file HTTP 请求工具
 * @description 基于 Axios 封装的 HTTP 请求实例，内置响应拦截器，统一处理常见 HTTP 错误。
 * @module src/api/http
 * @author ReinaManager
 * @copyright AGPL-3.0
 *
 * 主要导出：
 * - createHttp：创建带拦截器的 Axios 实例
 * - 默认导出 http：全局 HTTP 实例
 *
 * 依赖：
 * - axios
 */

import axios, { type AxiosError } from 'axios';

/**
 * 创建一个带有响应拦截器的 Axios 实例。
 *
 * 该函数会创建一个 Axios 实例，并添加响应拦截器以处理常见的 HTTP 错误。
 * 对 401（未认证）和 400（请求错误）等状态码进行友好提示，其他错误返回通用错误信息。
 *
 * @returns {import('axios').AxiosInstance} 配置好的 Axios 实例，用于发送 HTTP 请求。
 */
export const createHttp = ()=> {
    const http = axios.create({});

    // 添加响应拦截器，处理常见的 HTTP 错误
    http.interceptors.response.use(
        (response) => response,
        /**
         * 响应错误处理拦截器
         * @param {AxiosError} error - Axios 错误对象
         * @returns {string|void} 错误提示字符串或控制台输出
         */
       (error: AxiosError) => {
            if (error.response?.status === 401) {
                // 抛出自定义错误对象
                return Promise.reject(new Error("认证失败，请检查你的BGM_TOKEN是否正确"));
            }
            if (error.response?.status === 400) {
                // 抛出自定义错误对象
                return Promise.reject(new Error("未找到相关条目,请确认ID或游戏名字后重试"));
            }
            // 其他错误
            return Promise.reject(new Error("请求错误，请检查你的网络连接"));
        }
    );

    return http;
};

/**
 * 默认导出带拦截器的 Axios 实例。
 */
export default createHttp();