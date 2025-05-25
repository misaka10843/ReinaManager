<div align="center">
  <div style="width:200px">
    <a href="https://vndb.org/c64303">
      <img src="src-tauri/icons/reina.png" alt="Reina">
    </a>
  </div>

<h1>ReinaManager</h1>

![Status](https://img.shields.io/badge/status-active-brightgreen) ![Stage](https://img.shields.io/badge/stage-beta-blue) ![Build Status](https://github.com/huoshen80/ReinaManager/actions/workflows/build.yml/badge.svg)

<p align="center"><a href="./README.md">English</a>|<a href="./README.zh_CN.md">中文</a>|<a href="./README.zh_TW.md">繁體中文</a>|日本語</p>

<h5>軽量なビジュアルノベル管理ツール、開発中...</h5>

名前の `Reina` は、ゲーム <a href="https://vndb.org/v21852"><b>金色ラブリッチェ(Kin'iro Loveriche)</b></a> のキャラクター <a href="https://vndb.org/c64303"><b>妃 玲奈(Kisaki Reina)</b></a> に由来しています

</div>

## 技術スタック

- Tauri 2.0
- React
- Material UI
- UnoCSS
- Zustand
- Sqlite
- Rust

## Todo

- [x] ゲームを起動するための実行ファイルを追加
- [x] ローカルゲームフォルダを開く
- [x] ホームページ機能
- [x] ゲーム検索のためのVNDB APIを追加
- [x] 多言語対応
- [ ] ゲームのカスタムデータ
- [x] プレイ時間のカウント
- [ ] 各ページの美化
- [x] 詳細ページのデザイン
- [x] データベースクエリのリファクタリング
- [x] ゲーム検索のための混合APIを追加
- [x] 編集ページ機能

## デモバージョン

##### フロントエンドデモ
- ウェブ版を試す: [https://reina.huoshen80.top](https://reina.huoshen80.top)

##### デスクトップアプリケーションデモ
- GitHub Actionsから最新のビルドをダウンロード:
  1. [Actionsページ](https://github.com/huoshen80/ReinaManager/actions/workflows/build.yml)に移動
  2. 最新の成功したワークフローの実行をクリック
  3. 「Artifacts」セクションまでスクロール
  4. 必要なアーティファクトをダウンロード

## ライセンス

このプロジェクトは [AGPL-3.0 ライセンス](https://github.com/huoshen80/ReinaManager#AGPL-3.0-1-ov-file) の下で提供されています
