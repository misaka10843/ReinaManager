<div align="center">
  <div style="width:200px">
    <a href="https://vndb.org/c64303">
      <img src="src-tauri/icons/reina.png" alt="Reina">
    </a>
  </div>

<h1>ReinaManager</h1>

![Status](https://img.shields.io/badge/status-active-brightgreen) ![Stage](https://img.shields.io/badge/stage-beta-blue) ![Build Status](https://github.com/huoshen80/ReinaManager/actions/workflows/build.yml/badge.svg)

<p align="center"><a href="./README.md">English</a>|<a href="./README.zh_CN.md">中文</a>|繁體中文|<a href="./README.ja_JP.md">日本語</a></p>

<h5>一個輕量級的galgame/視覺小說管理工具，正在開發中...</h5>

名稱中的 `Reina` 來源於遊戲 <a href="https://vndb.org/v21852"><b>金色ラブリッチェ(Kin'iro Loveriche)</b></a> 中的角色 <a href="https://vndb.org/c64303"><b>妃 玲奈(Kisaki Reina)</b></a>

</div>

## 技術棧

- Tauri 2.0

- React

- Material UI

- UnoCSS

- Zustand

- Sqlite

- Rust

- SeaORM

## 待辦事項

- [x] 添加可執行文件以啟動遊戲
- [x] 打開本地遊戲資料夾
- [x] 主頁功能
- [x] 添加VNDB API用於搜尋遊戲
- [x] 國際化語言支持
- [ ] 遊戲的自定義數據
- [x] 統計遊戲時間
- [ ] 美化各個頁面
- [x] 設計詳情頁頁面
- [x] 重構數據庫查詢
- [x] 添加混合API搜尋遊戲
- [x] 編輯頁面功能
- [x] 自動備份功能
- [ ] 與Bangumi同步遊戲狀態
- [ ] 批量匯入遊戲
- [x] 工具：將whitecloud數據遷移到ReinaManager(請看 [reina_migrator](https://github.com/huoshen80/reina_migrator))
- [x] 添加NSFW內容過濾
- [x] 添加自定封面和自定名稱功能
- [x] 增強搜索功能以包括別名、所有標題和自定名稱
- [ ] 添加分類頁面以管理遊戲

## 展示

##### 前端展示
- 嘗試網頁版本：[https://reina.huoshen80.top](https://reina.huoshen80.top)
- 網頁版功能尚未完全實現，但您可以查看界面和部分功能。

##### 桌面應用展示

![主頁](screenshots/home.png)
![遊戲庫](screenshots/library.png)
![詳情頁](screenshots/detail.png)
![統計](screenshots/stats.png)
![設定頁](screenshots/setting.png)

更多資訊，您可以下載最新的發布版本：[下載](https://github.com/huoshen80/ReinaManager/releases)

## 貢獻
##### 開始
歡迎各種形式的貢獻！如果你有改進建議、發現了 bug，或想提交 Pull Request，請依照以下步驟：

1. Fork 本倉庫，並從 `main` 分支建立新分支。
2. 若修復了 bug 或新增功能，請盡量進行相關測試。
3. 請確保程式碼風格與現有代碼一致，並通過所有檢查。
4. 提交 Pull Request，並清楚描述你的更改內容。

##### 本機建構與執行專案
1. 確保已安裝 [Node.js](https://nodejs.org/) 及 [Rust](https://www.rust-lang.org/)。
2. Clone 倉庫：
   ```bash
   git clone https://github.com/huoshen80/ReinaManager.git
   cd ReinaManager
   ```
3. 安裝依賴：
   ```bash
   pnpm install
   ```
4. 啟動開發伺服器：
   ```bash
   pnpm tauri dev
   ```
5. 建構生產版本：
   ```bash
   pnpm tauri build
   ```

感謝你為 ReinaManager 做出的所有貢獻！

## Donate
如果你覺得這個專案好用，並希望支持項目的開發，可以考慮捐贈。非常感謝每個支持者！
- [donate link](https://cdn.huoshen80.top/233.html)

## 許可證

本專案採用 [AGPL-3.0 許可證](https://github.com/huoshen80/ReinaManager#AGPL-3.0-1-ov-file)

## Star 歷史

[![Star History Chart](https://api.star-history.com/svg?repos=huoshen80/ReinaManager&type=Date)](https://star-history.com/#huoshen80/ReinaManager&Date)
