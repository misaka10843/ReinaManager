<div align="center">
  <div style="width:200px">
    <a href="https://vndb.org/c64303">
      <img src="src-tauri/icons/reina.png" alt="Reina">
    </a>
  </div>

<h1>ReinaManager</h1>

![Status](https://img.shields.io/badge/status-active-brightgreen) ![Stage](https://img.shields.io/badge/stage-beta-blue) ![Build Status](https://github.com/huoshen80/ReinaManager/actions/workflows/build.yml/badge.svg)

<p align="center"><a href="./README.md">English</a>|中文|<a href="./README.zh_TW.md">繁體中文</a>|<a href="./README.ja_JP.md">日本語</a></p>

<h5>一个轻量级的galgame/视觉小说管理工具，正在开发中...</h5>

名称中的 `Reina` 来源于游戏 <a href="https://vndb.org/v21852"><b>金色ラブリッチェ(Kin'iro Loveriche)</b></a> 中的角色 <a href="https://vndb.org/c64303"><b>妃 玲奈(Kisaki Reina)</b></a>

</div>

## 技术栈

- Tauri 2.0

- React

- Material UI

- UnoCSS

- Zustand

- Sqlite

- Rust

- SeaORM

## 待办事项

- [x] 添加可执行文件以启动游戏
- [x] 打开本地游戏文件夹
- [x] 主页功能
- [x] 添加VNDB API用于搜索游戏
- [x] 国际化语言支持
- [ ] 游戏的自定义数据
- [x] 统计游戏时间
- [ ] 美化各个页面
- [x] 设计详情页页面
- [x] 重构数据库查询
- [x] 添加混合API搜索游戏
- [x] 编辑页面功能
- [x] 自动备份功能
- [ ] 与Bangumi同步游戏状态
- [ ] 批量导入游戏
- [x] 工具：将whitecloud数据迁移到ReinaManager(请看 [reina_migrator](https://github.com/huoshen80/reina_migrator))
- [x] 添加NSFW内容过滤
- [x] 添加自定义封面和自定义名称功能
- [x] 增强搜索功能以包括别名、所有标题和自定义名称
- [ ] 添加分类页面以管理游戏

## 展示

##### 前端展示
- 网页版本：[https://reina.huoshen80.top](https://reina.huoshen80.top)
- 网页版功能尚未完全实现，但您可以查看界面和部分功能。

##### 桌面应用展示

![主页](screenshots/home.png)
![游戏库](screenshots/library.png)
![详情页](screenshots/detail.png)
![统计](screenshots/stats.png)
![设置页](screenshots/setting.png)

更多内容，你可以下载最新的发布版本：[下载](https://github.com/huoshen80/ReinaManager/releases)

## 贡献
##### 开始
欢迎任何形式的贡献！如果你有改进建议、发现了 bug，或希望提交 Pull Request，请按照以下步骤操作：

1. Fork 本仓库，并从 `main` 分支创建新分支。
2. 如果修复了 bug 或新增了功能，请尽量进行相应测试。
3. 保证代码风格与现有代码一致，并通过所有检查。
4. 提交 Pull Request，并清晰描述你的更改内容。

##### 本地构建与运行项目
1. 确保你已安装 [Node.js](https://nodejs.org/) 和 [Rust](https://www.rust-lang.org/)。
2. 克隆仓库：
   ```bash
   git clone https://github.com/huoshen80/ReinaManager.git
   cd ReinaManager
   ```
3. 安装依赖：
   ```bash
   pnpm install
   ```
4. 运行开发服务器：
   ```bash
   pnpm tauri dev
   ```
5. 构建生产版本：
   ```bash
   pnpm tauri build
   ```

感谢你为 ReinaManager 做出的所有贡献！

## Donate
如果你觉得这个项目好用，并希望支持项目的开发，可以考虑捐赠。非常感谢每个支持者！
- [donate link](https://cdn.huoshen80.top/233.html)

## 许可证

本项目采用 [AGPL-3.0 许可证](https://github.com/huoshen80/ReinaManager#AGPL-3.0-1-ov-file)

## Star 历史

[![Star History Chart](https://api.star-history.com/svg?repos=huoshen80/ReinaManager&type=Date)](https://star-history.com/#huoshen80/ReinaManager&Date)