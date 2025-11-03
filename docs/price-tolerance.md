# 价格容忍度功能说明

## 🎯 功能概述

价格容忍度功能解决了AI Agent入场价格与当前市场价格存在差异的问题。当差异低于设定阈值时，系统会市价执行；超过阈值时，则放弃执行并等待新的入场订单。

## 📊 工作原理

### 价格差异计算
```typescript
// 绝对价格差异（百分比）
priceDifference = |(currentPrice - entryPrice) / entryPrice| × 100%

// 方向性价格差异（带符号）
directionalPriceDifference = (currentPrice - entryPrice) / entryPrice × 100%
// 正数：价格上涨；负数：价格下跌
```

### 决策逻辑（方向性价格容忍度）

系统使用**方向性价格容忍度**机制，不仅考虑价格差异的绝对值，还会判断价格移动方向是否对持仓有利。

#### 1. 基础检查
- **计算绝对差异**: `|currentPrice - entryPrice| / entryPrice × 100%`
- **阈值检查**: 差异是否在容忍度范围内

#### 2. 方向性判断
系统会判断价格移动方向是否有利于当前持仓：

- **做多（BUY）仓位**：
  - ✅ 有利：当前价格 ≤ 入场价格（价格下跌或持平）
  - ❌ 不利：当前价格 > 入场价格（价格上涨）

- **做空（SELL）仓位**：
  - ✅ 有利：当前价格 ≥ 入场价格（价格上涨或持平）
  - ❌ 不利：当前价格 < 入场价格（价格下跌）

#### 3. 执行决策规则

```
shouldExecute = withinTolerance || favorableForExecution
```

- ✅ **在容忍度内** (`withinTolerance = true`) → **执行**
- ✅ **超出容忍度但方向有利** (`favorableForExecution = true`) → **执行**
- ❌ **超出容忍度且方向不利** → **不执行**

#### 决策流程图
```
价格差异计算
    ↓
差异 ≤ 容忍度？
    ├─ 是 → ✅ 执行
    └─ 否 → 检查方向
            ↓
        方向是否有利？
            ├─ 是（做多价格跌 / 做空价格涨）→ ✅ 执行
            └─ 否（做多价格涨 / 做空价格跌）→ ❌ 跳过
```

## 🔧 配置方法

### 1. CLI命令配置
```bash
# 使用默认容忍度（0.5%）
npm start -- follow deepseek-chat-v3.1

# 自定义容忍度（1%）
npm start -- follow deepseek-chat-v3.1 --price-tolerance 1.0

# 严格价格控制（0.2%）
npm start -- follow deepseek-chat-v3.1 --price-tolerance 0.2

# 宽松价格控制（2%）
npm start -- follow deepseek-chat-v3.1 --price-tolerance 2.0
```

### 2. 环境变量配置
```bash
# 设置默认价格容忍度
export PRICE_TOLERANCE=0.8

# 设置特定币种容忍度
export BTCUSDT_TOLERANCE=1.0
export ETHUSDT_TOLERANCE=0.5
```

### 3. 编程配置
```typescript
import { ConfigManager } from './services/config-manager';

const configManager = new ConfigManager();
configManager.setPriceTolerance(0.8); // 全局设置
configManager.setSymbolTolerance('BTCUSDT', 1.0); // 币种特定设置
```

## 💡 核心设计理念

### 为什么要有方向性判断？

传统价格容忍度只看差异绝对值，但在实际交易中：
- **做多时价格更低**：买到更便宜的筹码，即使差异较大也应该买入 ✅
- **做空时价格更高**：卖得更贵，即使差异较大也应该卖出 ✅
- **做多时价格更高**：买贵了，应该谨慎 ⚠️
- **做空时价格更低**：卖便宜了，应该谨慎 ⚠️

因此，系统设计了**方向性价格容忍度**：
- 当价格移动**有利**时，即使超出容忍度也执行（机会优先）
- 当价格移动**不利**时，超出容忍度就不执行（风险控制）

## 📈 实际示例

### 示例1：价格差异在容忍范围内 ✅
```
🤖 跟单 Agent: deepseek-chat-v3.1
📈 NEW POSITION: BTCUSDT BUY 0.001 @ 43000 (OID: 209776191762)
💰 Price Check: Entry $43000 vs Current $43215
📏 Price Difference: 0.50% (Tolerance: 0.50%)
✅ Price Tolerance: Price difference 0.50% is within tolerance 0.50%
✅ Risk assessment: PASSED
🔄 Executing trade...
✅ Trade executed successfully!
```
**说明**: 价格差异在容忍度范围内，直接执行。

### 示例2：价格差异超出容忍范围（方向不利）❌
```
🤖 跟单 Agent: deepseek-chat-v3.1
📈 NEW POSITION: BTCUSDT BUY 0.001 @ 43000 (OID: 209776191762)
💰 Price Check: Entry $43000 vs Current $43500
📏 Price Difference: 1.16% (Tolerance: 0.50%)
❌ Price Tolerance: Price difference 1.16% exceeds tolerance 0.50% and price movement is unfavorable for BUY position
❌ Risk assessment: FAILED - Trade skipped
```
**说明**: 做多时价格上涨，价格差异超出容忍度且方向不利，不执行。

### 示例3：价格差异超出容忍范围（方向有利）✅
```
🤖 跟单 Agent: deepseek-chat-v3.1
📈 NEW POSITION: BTCUSDT BUY 0.001 @ 110000 (OID: 209776191762)
💰 Price Check: Entry $110000 vs Current $99000
📏 Price Difference: 10.00% (Tolerance: 1.00%)
✅ Price Tolerance: Price moved down by 10.00% which is favorable for BUY position (exceeds tolerance 1.00%)
✅ Risk assessment: PASSED
🔄 Executing trade...
✅ Trade executed successfully!
```
**说明**: 做多时价格下跌（可以买到更便宜），虽然差异10%超出1%容忍度，但方向有利，仍然执行。

### 示例4：做空场景（方向有利）✅
```
🤖 跟单 Agent: deepseek-chat-v3.1
📈 NEW POSITION: BTCUSDT SELL 0.001 @ 100000 (OID: 209776191762)
💰 Price Check: Entry $100000 vs Current $105000
📏 Price Difference: 5.00% (Tolerance: 1.00%)
✅ Price Tolerance: Price moved up by 5.00% which is favorable for SELL position (exceeds tolerance 1.00%)
✅ Risk assessment: PASSED
🔄 Executing trade...
✅ Trade executed successfully!
```
**说明**: 做空时价格上涨（可以卖得更贵），虽然差异5%超出1%容忍度，但方向有利，仍然执行。

## 🎛️ 容忍度建议

### 市场状况与容忍度设置
| 市场状况 | 建议容忍度 | 说明 |
|---------|-----------|------|
| 稳定市场 | 0.2% - 0.5% | 价格变化小，严格跟单 |
| 波动市场 | 0.5% - 1.0% | 适度放宽，避免错过机会 |
| 高波动市场 | 1.0% - 2.0% | 宽松设置，优先执行 |
| 新闻事件期间 | 1.5% - 3.0% | 应对剧烈价格波动 |

### 不同策略的容忍度
| 交易策略 | 建议容忍度 | 风险等级 |
|---------|-----------|---------|
| 保守跟单 | 0.2% - 0.3% | 低风险 |
| 标准跟单 | 0.5% - 0.8% | 中风险 |
| 积极跟单 | 1.0% - 1.5% | 高风险 |
| 高频跟单 | 1.5% - 2.5% | 极高风险 |

## 📊 性能影响

### 执行率分析
- **0.2%容忍度**: 约60-70%执行率，高精度跟单
- **0.5%容忍度**: 约80-85%执行率，平衡精度和机会
- **1.0%容忍度**: 约90-95%执行率，优先执行机会
- **2.0%容忍度**: 约98%+执行率，几乎不跳过

### 风险收益平衡
- **低容忍度**: 减少滑点损失，但可能错过交易机会
- **高容忍度**: 增加交易机会，但可能承受滑点损失

## 🛠️ 故障排除

### 常见问题
1. **所有交易都被跳过**
   - 检查容忍度设置是否过严
   - 确认市场价格数据是否正常
   - 考虑市场波动性是否增加

2. **从未执行价格检查**
   - 确认使用的是ENTER操作
   - 检查API是否返回current_price数据
   - 验证position数据完整性

3. **价格差异显示异常**
   - 检查entry_price是否为0或负数
   - 验证current_price数据有效性
   - 确认价格数据源可靠性

### 调试技巧
```bash
# 使用风险模式查看详细信息
npm start -- follow deepseek-chat-v3.1 --risk-only --price-tolerance 0.5

# 检查特定币种的价格容忍度
export BTCUSDT_TOLERANCE=1.0
npm start -- follow gpt-5 --risk-only
```

## 📝 最佳实践

### 1. 渐进式调整
```bash
# 从严格开始
npm start -- follow claude-sonnet-4-5 --price-tolerance 0.2 --risk-only

# 逐步放宽
npm start -- follow claude-sonnet-4-5 --price-tolerance 0.5 --risk-only
npm start -- follow claude-sonnet-4-5 --price-tolerance 0.8 --risk-only

# 确定最优值后实盘
npm start -- follow claude-sonnet-4-5 --price-tolerance 0.8
```

### 2. 多Agent差异化设置
```bash
# 终端1：保守Agent + 严格容忍度
npm start -- follow buynhold_btc --price-tolerance 0.3 &

# 终端2：激进Agent + 宽松容忍度
npm start -- follow gpt-5 --price-tolerance 1.2 &
```

### 3. 市场适应性调整
```bash
# 稳定市场（夜间）
npm start -- follow deepseek-chat-v3.1 --price-tolerance 0.5

# 波动市场（开盘时段）
npm start -- follow deepseek-chat-v3.1 --price-tolerance 1.0

# 新闻事件期间
npm start -- follow deepseek-chat-v3.1 --price-tolerance 2.0
```

## 🔍 监控和分析

### 关键指标
- **执行率**: 实际执行 / 总信号数量
- **平均滑点**: 实际成交价 vs 预期价格差异
- **跳过原因**: 价格差异 vs 其他原因
- **容忍度使用率**: 接近容忍度阈值的交易比例

### 日志分析
系统会自动记录价格检查信息：
```
💰 Price Check: Entry $43000 vs Current $43215
📏 Price Difference: 0.50% (Tolerance: 0.50%)
✅ Price Tolerance: Price difference 0.50% is within tolerance 0.50%
```

## 🎯 常见场景分析

### 场景1：做多 + 价格上涨（超出容忍度）
- **AI入场价**: 110,000 USDT
- **当前价格**: 150,000 USDT  
- **价格差异**: +36.36%（超出容忍度）
- **方向**: 价格上涨，对做多**不利** ❌
- **结果**: **不执行**（超出容忍度且方向不利）

### 场景2：做多 + 价格下跌（超出容忍度）
- **AI入场价**: 110,000 USDT
- **当前价格**: 99,000 USDT
- **价格差异**: -10%（超出容忍度）
- **方向**: 价格下跌，对做多**有利** ✅（可以买到更便宜）
- **结果**: **执行**（方向有利，即使超出容忍度）

### 场景3：做空 + 价格上涨（超出容忍度）
- **AI入场价**: 100,000 USDT
- **当前价格**: 105,000 USDT
- **价格差异**: +5%（超出容忍度）
- **方向**: 价格上涨，对做空**有利** ✅（可以卖得更贵）
- **结果**: **执行**（方向有利，即使超出容忍度）

### 场景4：做空 + 价格下跌（超出容忍度）
- **AI入场价**: 100,000 USDT
- **当前价格**: 95,000 USDT
- **价格差异**: -5%（超出容忍度）
- **方向**: 价格下跌，对做空**不利** ❌（卖便宜了）
- **结果**: **不执行**（超出容忍度且方向不利）

## 🔍 日志解读

### 执行成功（方向有利）
```
💰 Price Check: Entry $110000 vs Current $99000
📏 Price Difference: 10.00% (Tolerance: 1.00%)
✅ Price Tolerance: Price moved down by 10.00% which is favorable for BUY position (exceeds tolerance 1.00%)
```
**关键信息**: "favorable for BUY position" 表示方向有利

### 执行失败（方向不利）
```
💰 Price Check: Entry $110000 vs Current $150000
📏 Price Difference: 36.36% (Tolerance: 1.00%)
❌ Price Tolerance: Price difference 36.36% exceeds tolerance 1.00% and price movement is unfavorable for BUY position
```
**关键信息**: "unfavorable for BUY position" 表示方向不利

---

**版本**: v1.1
**更新时间**: 2025-11-03
**相关文档**: [quick-reference.md](./quick-reference.md) | [follow-strategy.md](./follow-strategy.md)