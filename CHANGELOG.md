## [0.6.7](https://github.com/huoshen80/ReinaManager/compare/v0.6.6...v0.6.7) (2025-09-06)


<details>
<summary>查看中文版本</summary>

### Bug 修复

* 更新到0.6.7版本，修复单实例插件的一个bug ([f72cb5a](https://github.com/huoshen80/ReinaManager/commit/f72cb5a69e731945f4f3a5a0f0b642ecd879693b))
* 更新日志样式未生效；未带 R18 标签的拔作（nukige）未被标记为 NSFW。 ([83de6f2](https://github.com/huoshen80/ReinaManager/commit/83de6f2614fcdb66a451fa786c178eac0d055dde))

### 新功能

* 增强 API 以获取游戏别名，向数据库新增自定义游戏信息字段 ([67d2efe](https://github.com/huoshen80/ReinaManager/commit/67d2efed572ae63cf69322281325491c22143c55))
* 增强搜索功能：支持游戏别名、备注与所有标题的搜索；新增游戏备注与自定义封面功能，解决 [#12](https://github.com/huoshen80/ReinaManager/issues/12) ([bd2cbe7](https://github.com/huoshen80/ReinaManager/commit/bd2cbe790d43d9f01627d820711954a480e8db8a))
* 实现增强搜索功能 ([#11](https://github.com/huoshen80/ReinaManager/issues/11)) ([bb7160a](https://github.com/huoshen80/ReinaManager/commit/bb7160a17c720cd10d3ade2284432751e809a3ea))
* VNDB 标签翻译（简体中文） ([#10](https://github.com/huoshen80/ReinaManager/issues/10)) ([35859c4](https://github.com/huoshen80/ReinaManager/commit/35859c4121aa3093de750dff3d339739783cf179))

</details>

### Bug Fixes

* update version to 0.6.7 with fix a bug of single-instance ([f72cb5a](https://github.com/huoshen80/ReinaManager/commit/f72cb5a69e731945f4f3a5a0f0b642ecd879693b))
* update log style is not effective, nukige without R18 tags are not marked as nsfw. ([83de6f2](https://github.com/huoshen80/ReinaManager/commit/83de6f2614fcdb66a451fa786c178eac0d055dde))


### Features

* enhance API to get game aliases, add custom game info field to the database ([67d2efe](https://github.com/huoshen80/ReinaManager/commit/67d2efed572ae63cf69322281325491c22143c55))
* enhance search functionality, support game aliases, notes, and all titles searching, add game notes, and customize cover features resolve [#12](https://github.com/huoshen80/ReinaManager/issues/12) ([bd2cbe7](https://github.com/huoshen80/ReinaManager/commit/bd2cbe790d43d9f01627d820711954a480e8db8a))
* Implement enhanced search functionality ([#11](https://github.com/huoshen80/ReinaManager/issues/11)) ([bb7160a](https://github.com/huoshen80/ReinaManager/commit/bb7160a17c720cd10d3ade2284432751e809a3ea))
* VNDB Tag Translation zh_CN ([#10](https://github.com/huoshen80/ReinaManager/issues/10)) ([35859c4](https://github.com/huoshen80/ReinaManager/commit/35859c4121aa3093de750dff3d339739783cf179))



## [0.6.6](https://github.com/huoshen80/ReinaManager/compare/v0.6.6-1...v0.6.6) (2025-08-27)


<details>
<summary>查看中文版本</summary>

### Bug 修复

* 更新至 v0.6.6 版本，增强更新日志和更新部分组件 ([7826c37](https://github.com/huoshen80/ReinaManager/commit/7826c3708f51c91045f22384b9ec1b7c27aa5477))

### 新功能

* 添加卡片点击模式设置（导航/选择），支持双击和长按启动游戏 关闭 [#4](https://github.com/huoshen80/ReinaManager/issues/4) ([4af1881](https://github.com/huoshen80/ReinaManager/commit/4af1881912ff48357ab484de5f22b6f5b2f59e99))
* 为Whitecloud提供数据迁移工具 详情见 [#4](https://github.com/huoshen80/ReinaManager/issues/4) ([523c71a](https://github.com/huoshen80/ReinaManager/commit/523c71a3fdaaf78855f6dca0638a414021781a84))

</details>

### Bug Fixes

* update to v0.6.6 with enhanced changelog and update modal ([7826c37](https://github.com/huoshen80/ReinaManager/commit/7826c3708f51c91045f22384b9ec1b7c27aa5477))


### Features

* add card click mode settings, support double-click and long press to launch game close [#4](https://github.com/huoshen80/ReinaManager/issues/4) ([4af1881](https://github.com/huoshen80/ReinaManager/commit/4af1881912ff48357ab484de5f22b6f5b2f59e99))
* provide data migration tools for whitecloud  link [#4](https://github.com/huoshen80/ReinaManager/issues/4) ([523c71a](https://github.com/huoshen80/ReinaManager/commit/523c71a3fdaaf78855f6dca0638a414021781a84))



## [0.6.6-pre1](https://github.com/huoshen80/ReinaManager/compare/v0.6.5...v0.6.6-pre1) (2025-08-25)

<details>
<summary>查看中文版本</summary>

### Bug 修复

* 修复右键菜单位置 [#9](https://github.com/huoshen80/ReinaManager/issues/9) ([9b8e94a](https://github.com/huoshen80/ReinaManager/commit/9b8e94a03fe6935656df80e3cfb383e47520c114))

### 新功能

* 添加更新检查，添加更新通知 UI，改进构建和发布流程 ([315407f](https://github.com/huoshen80/ReinaManager/commit/315407fa08937e715900c555ced822955580e2b7))
* 添加 NSFW 过滤器和 NSFW 替换封面 [#6](https://github.com/huoshen80/ReinaManager/issues/6) ([fe9c8d5](https://github.com/huoshen80/ReinaManager/commit/fe9c8d5f33be367d394bd905bc4506fa4aea7e3e))
* 工作进行中：添加更新器插件并实现更新检查功能 ([a4ccbca](https://github.com/huoshen80/ReinaManager/commit/a4ccbca90091601ac866addc52351a92abbae2c2))

</details>


### Bug Fixes

* location of the right-click menu [#9](https://github.com/huoshen80/ReinaManager/issues/9) ([9b8e94a](https://github.com/huoshen80/ReinaManager/commit/9b8e94a03fe6935656df80e3cfb383e47520c114))


### Features

* add update checking,add UI for update notifications,improve build and release process ([315407f](https://github.com/huoshen80/ReinaManager/commit/315407fa08937e715900c555ced822955580e2b7))
* add NSFW filter and NSFW replace cover [#6](https://github.com/huoshen80/ReinaManager/issues/6) ([fe9c8d5](https://github.com/huoshen80/ReinaManager/commit/fe9c8d5f33be367d394bd905bc4506fa4aea7e3e))
* WIP add updater plugin and implement update checking functionality ([a4ccbca](https://github.com/huoshen80/ReinaManager/commit/a4ccbca90091601ac866addc52351a92abbae2c2))



## [0.6.5](https://github.com/huoshen80/ReinaManager/compare/v0.6.4...v0.6.5) (2025-08-21)

<details>
<summary>查看中文版本</summary>

### Bug 修复

* v0.6.5 修复添加游戏检测功能逻辑并关闭自动数据库迁移 ([f5b310e](https://github.com/huoshen80/ReinaManager/commit/f5b310ed6e37571ebfd2785e881fe02cb9c95036))

</details>

### Bug Fixes

* v0.6.5 fix the added game detection function logic and turned off automatic database migration ([f5b310e](https://github.com/huoshen80/ReinaManager/commit/f5b310ed6e37571ebfd2785e881fe02cb9c95036))



## [0.6.4](https://github.com/huoshen80/ReinaManager/compare/v0.6.3...v0.6.4) (2025-08-19)

<details>
<summary>查看中文版本</summary>

### Bug 修复

* v0.6.4 修复信息框的一些 Bug，添加 API 错误提醒的国际化支持 ([7cbec41](https://github.com/huoshen80/ReinaManager/commit/7cbec41772dad85b88db25e6f5dd48fee39f2cdd))

</details>

### Bug Fixes

* v0.6.4 fix some bugs of infobox,add api error alert i18n support ([7cbec41](https://github.com/huoshen80/ReinaManager/commit/7cbec41772dad85b88db25e6f5dd48fee39f2cdd))
