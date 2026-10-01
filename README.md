<div align="center">
  <img src="./public/icon.png" alt="Personal Site Icon" width="128" height="128" />
  <h1>zenosite</h1>
  <p><sub>ASCII-styled 3D Cloud Personal Website</sub></p>
</div>

这是一个交互式个人主页项目，使用 Vue 3、TypeScript、Three.js、Pretext、GSAP 和自定义 ASCII 渲染层构建。

网站以全屏 3D 场景为核心，包含响应式导航、页面切换动画、ASCII 风格文本排版，以及移动端适配的联系入口。

ASCII动态背景来自Pretext仓库的官方demo: variable-typographic-ascii
3D模型来自sketchfab/@Robduc.

目前网站已经部署到了[zeno.is-a.dev](https://zeno.is-a.dev)

## 预览

![截图 1](./preview1.png)
![截图 2](./preview2.png)
你也可以点击[这里](https://zeno.is-a.dev)直接访问预览。

## 技术栈

- Vue 3
- Vue Router
- TypeScript
- Vite
- Three.js
- GSAP
- @chenglou/pretext

## 如何修改内容

日常改网站内容时，主要看这两个目录：

- `src/content/`：修改页面文本、项目介绍、社交徽章和联系方式。
- `src/config/`：修改相机、布局、断点、ASCII 显示参数等配置。

### 修改页面文字

页面文案集中在 `src/content/siteContent.ts`。

这里可以修改：

- `about`：关于我页面的文本、技术栈徽章、社交徽章。
- `experience`：经历页面的文本。
- `projects`：项目页面的文本。
- `contact`：联系页面的文本和联系方式。

常用字段说明：

- `lines`：页面上显示的 ASCII 文本内容。
- `badges`：技术栈徽章图片链接。
- `badgeAnchorLineIndex`：技术栈徽章插入到哪一行附近。
- `socialBadges`：社交徽章，支持跳转链接或复制文本。
- `socialBadgeAnchorLineIndex`：社交徽章插入到哪一行附近。
- `scrollable`：页面内容较长时是否允许滚动。

### 修改配置

配置文件集中在 `src/config/`。

- `src/config/ascii.ts`：ASCII 字符尺寸、缩放、偏移、文字避让模型的参数。
- `src/config/layout.ts`：首页和子页面的文字布局、边距、字号范围、对齐方式。
- `src/config/camera.ts`：3D 相机视角、环绕速度、页面切换时的相机位置。
- `src/config/rendering.ts`：主画布像素比例和镜面倒影分辨率上限。
- `src/config/breakpoints.ts`：响应式断点和移动端判断逻辑。

如果只是改文字，优先改 `src/content/siteContent.ts`。
如果要调整文字位置、大小、相机角度、移动端适配，再改 `src/config/` 里的文件。

### 性能处理

ASCII 和 3D 人物在同一个动画循环中逐帧更新，保持视觉同步。首页通过 Pretext 预处理文字，并缓存相同起点和可用宽度的换行结果；子页面只在页面或窗口尺寸变化时重新排版。文字和样式未变化时不重复写入 DOM，空白 ASCII 单元格跳过避让计算。

模型会预加载，镜面使用较小的渲染目标，隐藏标签页暂停场景渲染。项目页滚动时仍重新读取可见文字边界，保持 ASCII 避让与滚动位置同步。

## 项目结构

```text
src/
  assets/          静态样式和 3D 模型资源
  config/          相机、布局、断点、ASCII 显示配置
  content/         页面文案、项目介绍、徽章和联系方式
  router/          路由定义和页面配置
  scene/           Three.js 场景、ASCII 渲染、布局和动画运行时
  state/           共享导航状态
  views/           Vue 页面级组件
```

## 本地运行

安装依赖：

```sh
npm install
```

启动开发服务器：

```sh
npm run dev
```

构建生产版本：

```sh
npm run build
```

本地预览生产构建：

```sh
npm run preview
```

### 响应式回归验证

运行 `npm test` 检查基础逻辑。启动 `npm run dev` 后，打开 `/tests/responsive.html` 并点击 **Run tests**，可以在浏览器中验证真实路由、动画和 WebGL 场景。

回归场景包括首页与四个子页的桌面/手机往返、首次加载途中缩放、文字消散/相机移动/文字重现期间缩放、767/768 临界宽度、连续快速缩放、手机横屏和项目页滚动。测试也会在旧动画原本应完成的时间之后重新检查，防止过期回调覆盖新场景。

补充场景包括浏览器前进/后退、连续路由变化、文字/徽章动画取消后的 Promise 结束与重新启动，以及 1920px 宽、390px 和 160px 高的窗口。静态子页会根据高度调整字号，并允许文字或换行徽章溢出时滚动。

跨手机/桌面断点时回到首页，并恢复导航、文字与相机；在桌面范围内缩放时保留当前页面。测试页用于开发验证，不包含在生产入口中。

## 部署

这是一个静态 Vite 应用，生产构建产物会输出到 `dist/`。

`public/_redirects` 用于在 Netlify 这类静态托管平台上支持 SPA fallback 路由。

## 备注

- 3D 模型文件位于 `src/assets/models/cloud-from-world-of-final-fantasy.glb`。
- 个人介绍、项目描述、社交徽章链接位于 `src/content/siteContent.ts`。
- 项目在 `package.json` 中标记为 `private`，用于避免误发布到 npm；这不会影响 GitHub 仓库公开。
