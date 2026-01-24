import { defineConfig } from "i18next-cli";

export default defineConfig({
	locales: ["zh-CN", "zh-TW", "en-US", "ja-JP"],
	extract: {
		input: "src/**/*.{ts,tsx}",
		output: "src/locales/{{language}}.json",
		keySeparator: ".", // 用的是点号连接嵌套
		nsSeparator: false,
		defaultNS: false,
		defaultValue: "__MISSING__",
		removeUnusedKeys: true,
		preservePatterns: [
			"app.NAVIGATION.*",
			"utils.batchUpdate.*",
			"category.playStatus.*",
		],
	},
});
