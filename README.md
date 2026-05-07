# WindOps BC Analyzer

风电运维商业案例智能分析工具 — 基于本地 AI 的成本推断与多方案对比系统。

---

## 版本

| 分支 | 版本 | 说明 |
|------|------|------|
| `main` | v2.0 | 稳定版，支持 Ollama / OpenAI 兼容 API 双模式 |
| `1.1-EXP` | v1.1-EXP | 实验分支：46条规则系统 + 适用流程维度 + 统计计算 fallback |

---

## 功能简介

将风电运维财务成本记录（~5,000 行，14 个字段）导入系统后，AI 自动理解 CostGroup 成本分类体系，在工程师创建维修案例时，根据历史数据推断零部件、吊车、运输、人力等 7 类成本，并生成丹麦海运 / 中国空运 / 当地陆运三种采购方案的完整成本对比。

### 核心模块

| 模块 | 说明 |
|------|------|
| **AI 配置** | 配置本地 Ollama 地址和模型，一键测试连接 |
| **数据管理** | 上传 CSV/Excel 历史数据，预览概览，自动映射 CostGroup → 业务成本分类 |
| **案例创建** | 表单分为 🟡用户输入区（机型/国家/故障描述等）和 🟢AI推断区（7类成本自动填充） |
| **案例审核** | 工程师审查 AI 推断结果，直接在表格中修改成本数值 |
| **方案对比** | 三栏并排展示 A/B/C 三方案，最优方案绿色高亮 + ⭐推荐，支持导出 CSV |
| **规则管理** | 46 条全局业务规则，按「适用流程」自动分流到创建案例 / 生成方案 |

### 技术栈

- **前端**：React 18 + TypeScript + Ant Design 5 + Zustand + Vite
- **后端**：FastAPI + SQLAlchemy 2.0 + SQLite
- **AI**：Ollama 本地部署（推荐 qwen2.5:7b），流式 SSE 通信
- **运行方式**：纯 localhost，所有数据不出本地网络

---

## 1.1-EXP 实验分支更新内容

### 规则系统重构

基于 HTML 规则源文件（模块 6：知识与规则沉淀 — 预置规则全集（更新版）.html），系统启动时自动解析并加载 **46 条**预置业务规则，按 4 组分类：

| 组 | 规则数 | 适用流程 | 内容 |
|----|--------|----------|------|
| A | 24 | 生成方案 | 零部件成本（采购地×5）、运输费用（海/陆/空×区域×13）、管理费（×3）、基础运输天数（×4） |
| B | 10 | 生成方案 | 国家时效敏感度罚款权重（0.70~1.30，按 11 国） |
| C | 6 | 生成方案 | 台风季天数 Buffer（0~+10d，按季节+区域） |
| D | 6 | 创建案例 | 历史数据中位数聚合、异常值检测、等权处理、最小样本量 |

**7 种规则类型**：倍数、加值、上限、下限、统计策略、检测规则、标记规则

### 适用流程（applicable_flow）

每条规则新增「适用流程」维度。AI 分析时**按流程自动过滤**：

- **创建案例**：仅加载 D 组 6 条规则（历史数据处理策略）
- **生成方案**：仅加载 A/B/C 组 40 条规则（采购运输、时效、台风等计算规则）

### AI Fallback 机制

当 AI 模型不可用或返回空结果时，自动降级为 **Python 统计计算**：

1. 按 Platform + Component 匹配历史数据
2. 取各 CostGroup 中位数
3. 按 CostGroup → 业务成本映射聚合为 7 类成本
4. 匹配数据不足时自动降级为全局统计

### CostGroup 自动映射

上传 Excel 数据后，系统自动扫描所有 CostGroup 值，按关键字匹配（Parts→零部件成本、Crane→吊车成本 等）建立映射关系，无需手动配置。

---

## 快速开始

### 前置要求

| 环境 | 最低版本 | 说明 |
|------|----------|------|
| Python | ≥ 3.11 | 后端运行环境 |
| Node.js | ≥ 18 | 前端运行环境 |
| Ollama | 最新版 | 本地 AI 模型服务 |
| 内存 | ≥ 8 GB | 推荐 qwen2.5:7b（约 4GB 显存/内存） |

### 第一步：安装依赖

双击项目根目录的 `setup.bat`，脚本会自动检查环境并安装所有依赖。

或手动执行：

```bash
# 后端依赖
cd backend
pip install fastapi "uvicorn[standard]" sqlalchemy aiosqlite httpx pandas openpyxl python-multipart pydantic

# 前端依赖
cd ../frontend
npm install
```

### 第二步：启动 Ollama 并拉取模型

```bash
ollama serve                     # 启动 Ollama 服务
ollama pull qwen2.5:7b           # 拉取推荐模型（首次，约 4.7 GB）
```

> 也可使用其他模型如 `qwen2.5:14b`（约 9 GB，需 ≥ 16 GB 内存）或 `gemma3:4b`（轻量）。

### 第三步：启动应用

双击 `start.bat` 一键启动前后端，或手动执行：

```bash
# 终端 1 — 启动后端 (http://localhost:8000)
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# 终端 2 — 启动前端 (http://localhost:5173)
cd frontend
npm run dev
```

后端 API 文档：打开浏览器访问 http://localhost:8000/docs

### 第四步：使用流程

1. **配置 AI 模型** — 在「AI 配置」页输入 `http://localhost:11434`，选择 `qwen2.5:7b`，点击测试连接
2. **上传历史数据** — 在「数据管理」页上传 Excel/CSV 文件（14 列字段），自动建立 CostGroup 映射
3. **检查规则** — 在「规则管理」页查看 46 条预置规则，可按适用流程过滤
4. **创建案例** — 在「案例创建」页填写故障信息，点击「创建并 AI 自动填充」
5. **审核成本** — 在审核页检查推断的各项成本，可手动修改，保存后生成方案
6. **对比方案** — 查看三方案对比，最优方案自动高亮，可导出 CSV

---

## 项目结构

```
APP_BC003/
├── setup.bat              # 一键环境安装
├── start.bat              # 一键启动前后端
├── README.md              # 本文档
├── rule.md                # 规则源文件（markdown）
├── 模块 6：…（更新版）.html  # 规则源文件（HTML，1.1-EXP 使用）
├── backend/
│   └── app/
│       ├── main.py        # FastAPI 入口 + 种子数据
│       ├── config.py      # 全局配置
│       ├── api/           # REST API 路由 (5 个模块)
│       ├── models/        # SQLAlchemy ORM 模型 (9 张表)
│       ├── schemas/       # Pydantic 请求/响应模型
│       ├── services/      # 业务逻辑 (数据服务 + AI服务 + 规则解析器)
│       └── db/            # 数据库引擎
└── frontend/
    └── src/
        ├── pages/         # 6 个页面组件
        ├── stores/        # Zustand 状态管理 (4 个 store)
        ├── api/           # Axios HTTP 客户端
        ├── types/         # TypeScript 类型定义
        └── components/    # 布局组件
```

---

## 常见问题

**Q: Ollama 连接失败？**
A: 确认 Ollama 已在后台运行，默认端口 11434。可在 AI 配置页点击「测试连接」验证。

**Q: llama runner process has terminated？**
A: 模型进程崩溃，通常是因为显存/内存不足。尝试使用更小模型（如 `qwen2.5:7b` 或 `gemma3:4b`），重启 Ollama 后重试。

**Q: 创建案例返回空？**
A: v1.1-EXP 已内置统计计算 fallback。若 AI 不可用，系统自动降级为 Python 中位数聚合，仍会返回成本数据。可在「数据管理」页确认已上传数据且 CostGroup 映射已建立。

**Q: 无法导入 xlsx？**
A: 已安装 openpyxl 依赖，确保 `pip install openpyxl` 成功。也可转换为 CSV 格式上传。
