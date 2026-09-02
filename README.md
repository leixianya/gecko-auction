# 爬拍所｜睫角守宫竞拍市场

一个独立品牌的前端竞拍市场，借鉴爬宠交易平台常见的信息架构：拍品浏览、筛选、倒计时、加价、代理竞价、账户保证金、竞拍记录、规则说明与钱包状态。

在线访问：<https://mcp.edgeone.site/share/l3v7T8kp31kvKS9-PhWKQ> · 源码：<https://github.com/leixianya/gecko-auction>

页面不连接支付、银行卡、身份证或订单后台；金额、账户余额、热度与竞拍者由浏览器端状态驱动。图片来源与许可记录见 [`assets/ATTRIBUTIONS.md`](assets/ATTRIBUTIONS.md)。

## 本地预览

```bash
cd /Users/minimax/gecko-auction
python3 -m http.server 4173
```

打开 <http://localhost:4173/>。

## 设计边界

本项目实现与“爬宠竞拍”同类的交互流程，但不复制任何第三方平台的商标、Logo、专属文案、截图或代码。公开发布前请核对图片许可，并遵守活体动物交易、运输和动物福利相关规定。
