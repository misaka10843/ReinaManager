<div align="center">
  <div style="width:200px">
    <a href="https://vndb.org/c64303">
      <img src="src-tauri/icons/reina.png" alt="Reina">
    </a>
  </div>

<h1>ReinaManager</h1>

![Status](https://img.shields.io/badge/status-active-brightgreen) ![Stage](https://img.shields.io/badge/stage-beta-blue) ![Build Status](https://github.com/huoshen80/ReinaManager/actions/workflows/build.yml/badge.svg)

<p align="center"><a href="./README.md">English</a>|<a href="./README.zh_CN.md">中文</a>|<a href="./README.zh_TW.md">繁體中文</a>|日本語</p>

<h5>軽量なギャルゲー・ビジュアルノベル管理ツール、開発中...</h5>

名前の `Reina` は、ゲーム <a href="https://vndb.org/v21852"><b>金色ラブリッチェ(Kin'iro Loveriche)</b></a> のキャラクター <a href="https://vndb.org/c64303"><b>妃 玲奈(Kisaki Reina)</b></a> に由来しています

</div>

## Stacks

- Tauri 2.0

- React

- Material UI

- UnoCSS

- Zustand

- Sqlite

- Rust

- SeaORM


## やることリスト（Todo）

- [x] exeを追加してゲームを起動
- [x] ローカルゲームフォルダを開く
- [x] ホームページ機能
- [x] VNDB APIでゲーム検索
- [x] 多言語対応（I18n）
- [ ] ゲームのカスタムデータ
- [x] プレイ時間の計測
- [ ] 各ページの美化
- [x] 詳細ページのデザイン
- [x] データベースクエリのリファクタリング
- [x] Mixed APIでゲーム検索
- [x] 編集ページ機能
- [x] 自動バックアップ機能
- [ ] Bangumiとゲームステータスの同期
- [ ] ゲームの一括インポート
- [x] ツール：whitecloudデータをReinaManagerに移行（[reina_migrator](https://github.com/huoshen80/reina_migrator)を参照）
- [x] NSFWフィルタの非表示機能を追加
- [x] カスタムカバーとカスタム名の追加機能
- [x] 検索機能を強化して、別名、すべてのタイトル、およびカスタム名を含める
- [ ] ゲーム管理のためのカテゴリページを追加

## デモバージョン

##### フロントエンドデモ
- Web版を試す: [https://reina.huoshen80.top](https://reina.huoshen80.top)
- Web版はまだ完全に機能していませんが、UIといくつかの機能を確認できます。

##### デスクトップアプリデモ

![ホーム](screenshots/home.png)
![ライブラリ](screenshots/library.png)
![詳細](screenshots/detail.png)
![統計](screenshots/stats.png)
![設定](screenshots/setting.png)

詳細については、最新のリリース版をダウンロードしてください：[ダウンロード](https://github.com/huoshen80/ReinaManager/releases)

## コントリビュート
##### まず
貢献は大歓迎です！改善提案、バグ報告、プルリクエストの送信は以下の手順に従ってください：

1. このリポジトリをフォークし、`main` ブランチから新しいブランチを作成します。
2. バグ修正や機能追加を行った場合は、適切なテストを追加してください。
3. コードスタイルを既存のプロジェクトに合わせ、すべてのチェックを通過させてください。
4. 変更内容を明確に説明したプルリクエストを作成してください。

##### プロジェクトをローカルでビルド・実行する方法
1. [Node.js](https://nodejs.org/) と [Rust](https://www.rust-lang.org/) をインストールします。
2. リポジトリをクローン：
   ```bash
   git clone https://github.com/huoshen80/ReinaManager.git
   cd ReinaManager
   ```
3. 依存関係をインストール：
   ```bash
   pnpm install
   ```
4. 開発サーバーを起動：
   ```bash
   pnpm tauri dev
   ```
5. 本番向けビルド：
   ```bash
   pnpm tauri build
   ```

ReinaManager へのすべての貢献に感謝します！

## Donate
このプロジェクトが役立つと感じ、開発を支援したい場合は、寄付をご検討ください。あなたの支援は大変ありがたいです！
- [donate link](https://cdn.huoshen80.top/233.html)

## ライセンス

本プロジェクトは [AGPL-3.0 ライセンス](https://github.com/huoshen80/ReinaManager#AGPL-3.0-1-ov-file) の下で公開されています。

## Star履歴

[![Star History Chart](https://api.star-history.com/svg?repos=huoshen80/ReinaManager&type=Date)](https://star-history.com/#huoshen80/ReinaManager&Date)
