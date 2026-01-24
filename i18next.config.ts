import { defineConfig } from 'i18next-cli';

export default defineConfig({
  locales: [
    "zh-CN",
    "zh-TW",
    "en-US",
    "ja-JP"
  ],
  extract: {
    input: "src/**/*.{js,jsx,ts,tsx}",
    output: "src/locales/{{language}}.json"
  }
});