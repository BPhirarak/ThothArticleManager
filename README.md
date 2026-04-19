# SYS Knowledge Hub

**ระบบจัดการความรู้ด้านอุตสาหกรรมเหล็ก | Steel Industry Knowledge Management System**

SYS Co., Ltd. — Structural Steel Manufacturing, Rayong, Thailand

---

## Features

| Feature | Description |
|---|---|
| 📚 Article Library | Search, filter, and read summaries in Thai & English |
| 🕸️ Knowledge Graph | Interactive network graph linking related articles |
| 🤖 AI Chat | RAG-powered Q&A across all articles |
| ➕ Add Articles | Upload PDFs manually or auto-fetch from AIST |
| 📊 Dashboard | Generate reports or PowerPoint from selected articles |
| ⚙️ Settings | Configure LLM providers and manage the knowledge graph |

---

## Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+
- npm 9+

### 1. Clone / extract the project
```bash
cd sys-knowledge-hub
```

### 2. Configure environment
```bash
cp backend/.env.example backend/.env
```
Edit `backend/.env` and add your API key:
```
OPENAI_API_KEY=sk-your-key-here
```

### 3. Copy your PDFs (seed articles)
Copy the 4 downloaded PDFs to the `uploads/` folder:
```
uploads/
├── PR-PM0426-3_Decarbonizing_Integrated_Steel_Mill.pdf
├── PR-PM0226-5_High_Performance_Submerged_Entry_Nozzle.pdf
├── PR-PM0226-2_Differentiating_Performance_Water_Glycol_Fluids.pdf
└── PR-PM0326-2_Process_Line_Debottlenecking_Empirical_Model.pdf
```

### 4. Run
```bash
bash run.sh
```

- **Frontend:** http://localhost:5173
- **API Docs:** http://localhost:8000/docs

---

## Manual Setup (if run.sh doesn't work on Windows)

### Backend
```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

pip install -r requirements.txt
python seed_data.py
uvicorn main:app --reload --port 8000
```

### Frontend (new terminal)
```bash
cd frontend
npm install
npm run dev
```

---

## Environment Variables (`backend/.env`)

| Variable | Description | Default |
|---|---|---|
| `LLM_PROVIDER` | `openai` or `bedrock` | `openai` |
| `OPENAI_API_KEY` | OpenAI API key | — |
| `OPENAI_MODEL` | Model name | `gpt-4o` |
| `AWS_ACCESS_KEY_ID` | AWS credentials | — |
| `AWS_SECRET_ACCESS_KEY` | AWS credentials | — |
| `AWS_REGION` | Bedrock region | `ap-southeast-1` |
| `BEDROCK_MODEL_ID` | Claude model ID | `anthropic.claude-sonnet-4-6` |
| `AIST_USER` | AIST member ID | `153585` |
| `AIST_PASSWORD` | AIST password | — |

---

## Project Structure

```
sys-knowledge-hub/
├── backend/
│   ├── main.py              # FastAPI app
│   ├── models.py            # SQLAlchemy DB models
│   ├── database.py          # DB connection
│   ├── config.py            # Settings from .env
│   ├── seed_data.py         # Initial 4 articles
│   ├── requirements.txt
│   ├── .env.example
│   ├── routers/
│   │   ├── articles.py      # CRUD + PDF upload
│   │   ├── graph.py         # Knowledge graph API
│   │   ├── chat.py          # RAG chat API
│   │   ├── dashboard.py     # Report generation
│   │   └── agent.py         # AIST automation
│   └── services/
│       ├── pdf_service.py   # PyMuPDF extraction
│       ├── ai_service.py    # OpenAI + Bedrock
│       ├── graph_service.py # NetworkX graph
│       ├── vector_service.py # ChromaDB RAG
│       └── aist_agent.py    # Playwright browser
├── frontend/
│   └── src/
│       ├── pages/           # 6 main pages
│       └── api.js           # API client
├── uploads/                 # PDF storage
└── run.sh                   # Start script
```

---

## Deployment to AWS

For production deployment on SYS internal AWS server:

1. Use `nginx` as reverse proxy (frontend on port 80, API on /api)
2. Use `systemd` or `pm2` to keep services running
3. Set `DATABASE_URL` to a persistent path outside the project directory
4. Use AWS RDS instead of SQLite for multi-user production use
5. Use AWS S3 for PDF storage instead of local `uploads/`

---

*Built for SYS Co., Ltd. | CDO Office — Digital Transformation*
