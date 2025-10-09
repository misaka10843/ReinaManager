<div align="center">
  <div style="width:200px">
    <a href="https://vndb.org/c64303">
      <img src="src-tauri/icons/reina.png" alt="Reina">
    </a>
  </div>

<h1>ReinaManager</h1>

![Status](https://img.shields.io/badge/status-active-brightgreen) ![Stage](https://img.shields.io/badge/stage-beta-blue) ![Build Status](https://github.com/huoshen80/ReinaManager/actions/workflows/build.yml/badge.svg)

<p align="center">English|<a href="./README.zh_CN.md">中文</a>|<a href="./README.zh_TW.md">繁體中文</a>|<a href="./README.ja_JP.md">日本語</a></p>

<h5>A lightweight galgame/visual-novel manager,Under development...</h5>

The `Reina` in the name is the character <a href="https://vndb.org/c64303"><b>妃 玲奈(Kisaki Reina)</b></a> from game <a href="https://vndb.org/v21852"><b>金色ラブリッチェ(Kin'iro Loveriche)</b></a>

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

## Todo

- [x] Add exe to Launch games
- [x] Open the local game folder
- [x] Home page functions
- [x] Add VNDB api to search games
- [x] I18n support
- [ ] Custom data of games
- [x] Count the time spent playing
- [ ] Beautify individual pages
- [x] Design the detail page
- [x] Refactor database queries
- [x] Add mixed api to search games
- [x] Edit page functions
- [x] Auto backup function
- [ ] Sync games status with Bangumi
- [ ] Bulk import games
- [x] Tool: migrate whitecloud data into ReinaManager(view [reina_migrator](https://github.com/huoshen80/reina_migrator))
- [x] Add hide NSFW filter
- [x] Add custom cover and custom name for games
- [x] enhance search function to include alias, all titles and custom name
- [ ] Add category page for manage games

## Demo
##### Frontend Demo
- Try the web version: [https://reina.huoshen80.top](https://reina.huoshen80.top)
- The web version is not fully functional yet, but you can view the UI and some features.

##### Desktop App Demo

![Home](screenshots/home.png)
![Library](screenshots/library.png)
![Detail](screenshots/detail.png)
![Stats](screenshots/stats.png)
![Setting](screenshots/setting.png)

For more, you can download the latest Release Version: [Download](https://github.com/huoshen80/ReinaManager/releases)

## Contribution
##### Start
Contributions are welcome! If you have suggestions for improvements, bug reports, or want to submit a pull request, please follow these steps:

1. Fork this repository and create your branch from `main`.
2. If you have fixed a bug or added a feature, please try to conduct the corresponding tests.
3. Ensure your code follows the existing style and passes all checks.
4. Submit a pull request with a clear description of your changes.

##### How to build and run the project locally
1. Make sure you have [Node.js](https://nodejs.org/) and [Rust](https://www.rust-lang.org/) installed on your machine.
2. Clone the repository:
   ```bash
   git clone https://github.com/huoshen80/ReinaManager.git
   cd ReinaManager
   ```
3. Install the dependencies:
   ```bash
   pnpm install
   ```
4. Run the development server:
   ```bash
   pnpm tauri dev
   ```
5. Build the application for production:
   ```bash
   pnpm tauri build
   ```

Thank you for all the contributions you have made to ReinaManager!

## Donate
If you find this project helpful and would like to support its development, you can consider donating. Your support is greatly appreciated!
- [donate link](https://cdn.huoshen80.top/233.html)

## License

This project is licensed under the [AGPL-3.0 license](https://github.com/huoshen80/ReinaManager#AGPL-3.0-1-ov-file)

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=huoshen80/ReinaManager&type=Date)](https://star-history.com/#huoshen80/ReinaManager&Date)



