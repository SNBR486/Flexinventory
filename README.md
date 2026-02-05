<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# FlexInventory

基于 React + PocketBase 的库存管理系统（含登录、入库、出库、字段配置与导出）。

## Run Locally

**Prerequisites:** Node.js, PocketBase

1. 安装依赖：
   `npm install`
2. （可选）在 `.env.local` 配置：
   - `VITE_POCKETBASE_URL=http://你的主机IPv4:8090`
3. 启动前端：
   `npm run dev -- --host 0.0.0.0 --port 3000`
4. 启动 PocketBase（确保监听 `0.0.0.0:8090`）

## 局域网访问说明

你的目标场景是：局域网设备访问 `http://主机IPv4:8090/` 并使用 PocketBase 中账号密码登录。

- 若前端构建产物已放入 PocketBase 的 `pb_public`，并由 PocketBase 在 `8090` 提供静态页面，前端会自动请求同主机 `8090` 的 PocketBase API。
- 若前端通过 Vite 开发服务器（如 `3000`）访问，前端也会自动请求同主机的 `:8090`。
- 你也可以显式配置 `VITE_POCKETBASE_URL` 绑定到指定 IP，避免多网卡场景下解析到错误主机。

## Build

`npm run build`

构建产物默认在 `dist/`。如需让 PocketBase 直接托管前端，请将构建后的文件同步到 `PB_DIR/pb_public/`（例如 `pocketbase*/pb_public/`）。
