# WindOps BC Analyzer

风电运维商业案例智能分析工具 — 基于本地 AI 的成本推断与多方案对比系统。

---

## 功能简介

将风电运维财务成本记录（~5,000 行，14 个字段）导入系统后，AI 自动理解 CostGroup 成本分类体系，在工程师创建维修案例时，根据历史数据推断零部件、吊车、运输、人力等 7 类成本，并生成丹麦海运 / 中国空运 / 当地陆运三种采购方案的完整成本对比。

### 核心模块

| 模块 | 说明 |
|------|------|
| **AI 配置** | 配置本地 Ollama 地址和模型，一键测试连接 |
| **数据管理** | 上传 CSV/Excel 历史数据，预览概览，AI 自动映射 CostGroup → 业务成本分类 |
| **案例创建** | 表单分为 🟡用户输入区（机型/国家/故障描述等）和 🟢AI推断区（7类成本自动填充） |
| **案例审核** | 工程师审查 AI 推断结果，直接在表格中修改成本数值 |
| **方案对比** | 三栏并排展示 A/B/C 三方案，最优方案绿色高亮 + ⭐推荐，支持导出 CSV |
| **规则管理** | 全局/客户级经验规则持久化，AI 分析时自动引用 |

### 技术栈

- **前端**：React 18 + TypeScript + Ant Design 5 + Zustand + Vite
- **后端**：FastAPI + SQLAlchemy 2.0 + SQLite
- **AI**：Ollama 本地部署（推荐 qwen2.5:14b），流式 SSE 通信
- **运行方式**：纯 localhost，所有数据不出本地网络

---

## 快速开始

### 前置要求

| 环境 | 最低版本 | 说明 |
|------|----------|------|
| Python | ≥ 3.11 | 后端运行环境 |
| Node.js | ≥ 18 | 前端运行环境 |
| Ollama | 最新版 | 本地 AI 模型服务 |
| 内存 | ≥ 16 GB | 运行 qwen2.5:14b 需较大内存 |

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
ollama pull qwen2.5:14b          # 拉取推荐模型（首次）
```

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

1. **配置 AI 模型** — 在「AI 配置」页输入 `http://localhost:11434`，选择 `qwen2.5:14b`，点击测试连接
2. **上传历史数据** — 在「数据管理」页上传 `datafortesting.xlsx`，会自动解析 14 列字段
3. **AI 映射 CostGroup** — 点击「AI 分析 CostGroup 分类」，确认映射关系后保存
4. **创建案例** — 在「案例创建」页填写故障信息，点击「创建并 AI 自动填充」
5. **审核成本** — 在审核页检查 AI 推断的各项成本，可手动修改，保存后生成方案
6. **对比方案** — 查看三方案对比，最优方案自动高亮，可导出 CSV

---

## 项目结构

```
APP_BC003/
├── setup.bat              # 一键环境安装
├── start.bat              # 一键启动前后端
├── backend/
│   └── app/
│       ├── main.py        # FastAPI 入口
│       ├── config.py      # 全局配置
│       ├── api/           # REST API 路由
│       ├── models/        # SQLAlchemy ORM 模型 (9 张表)
│       ├── schemas/       # Pydantic 请求/响应模型
│       ├── services/      # 业务逻辑 (数据服务 + AI服务)
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

**Q: 内存不足？**
A: 可尝试使用较小模型 `ollama pull qwen2.5:7b`，然后在 AI 配置页切换模型。

**Q: 无法导入 xlsx？**
A: 已安装 openpyxl 依赖，确保 `pip install openpyxl` 成功。也可转换为 CSV 格式上传。
