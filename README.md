# WindOps BC Analyzer

风电运维商业案例智能分析工具 — 基于本地 AI 的成本推断与多方案对比系统。

---

## 版本

| 分支 | 版本 | 说明 |
|------|------|------|
| `main` | **v1.2** | 稳定发布版：5方案 + 综合评分 + 可视化仪表盘 + 权重配置 |
| `develop` | v1.2-dev | 开发版 |

---

## 功能简介

将风电运维财务成本记录导入系统后，AI 自动理解 CostGroup 成本分类体系，生成 **5 种采购方案** 并对比分析。

### 核心模块

| 模块 | 说明 |
|------|------|
| **AI 配置** | 模型连接 + 评分权重配置（4 因子可调） |
| **数据管理** | 上传 Excel/CSV，自动 CostGroup 映射 |
| **案例创建** | 用户输入 + AI 自动填充 7 类成本 |
| **案例审核** | 审查修改成本数值 |
| **方案对比** | 5 列方案 + 综合评分排名 + 不可行标记 |
| **可视化仪表盘** | 4 种图表 + AI 推荐结论 |
| **规则管理** | 46 条规则，按适用流程自动分流 |

### 技术栈

- **前端**：React 18 + TypeScript + Ant Design 5 + Zustand + Vite + Recharts
- **后端**：FastAPI + SQLAlchemy 2.0 + SQLite
- **AI**：Ollama（推荐 qwen2.5:7b）+ SSE 流式
- **规则引擎**：Python 确定性计算，condition_json 元数据驱动

---

## 快速开始

| 环境 | 版本 |
|------|------|
| Python | ≥ 3.11 |
| Node.js | ≥ 18 |
| Ollama | 最新版 |
| 内存 | ≥ 8 GB |

```bash
ollama pull qwen2.5:7b
双击 setup.bat → start.bat
```

前端 http://localhost:5173 | 后端 API http://localhost:8000/docs

---

## 架构

```
用户审核成本 → 规则引擎 5方案计算 → 先保存DB（立即可用）
  → AI 异步润色 → 综合评分 → 仪表盘图表 → Excel/PDF 导出
```
