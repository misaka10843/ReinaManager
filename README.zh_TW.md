<div align="center">
  <div style="width:200px">
    <a href="https://vndb.org/c64303">
      <img src="src-tauri/icons/reina.png" alt="Reina">
    </a>
  </div>

<h1>ReinaManager</h1>

![Status](https://img.shields.io/badge/status-active-brightgreen) ![Stage](https://img.shields.io/badge/stage-beta-blue) ![Build Status](https://github.com/huoshen80/ReinaManager/actions/workflows/build.yml/badge.svg)

<p align="center"><a href="./README.md">English</a>|<a href="./README.zh_CN.md">中文</a>|繁體中文|<a href="./README.ja_JP.md">日本語</a></p>

<h5>一個輕量級的視覺小說管理工具，正在開發中...</h5>

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


## 演示版本

##### 前端演示
- 嘗試網頁版本：[https://reina.huoshen80.top](https://reina.huoshen80.top)

##### 桌面應用演示
- 從GitHub Actions下載最新構建：
  1. 前往 [Actions頁面](https://github.com/huoshen80/ReinaManager/actions/workflows/build.yml)
  2. 點擊最近成功的workflow run
  3. 滾動到"Artifacts"部分
  4. 下載您需要的構件

## 許可證

本專案採用 [AGPL-3.0 許可證](https://github.com/huoshen80/ReinaManager#AGPL-3.0-1-ov-file)
