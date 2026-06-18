# 🤖 Multi-AI-Agent Swarm Orchestration System

An automated, multi-agent industrial emergency incident containment system built with **Band.ai** and **Groq API**. 

This project demonstrates a robust multi-agent orchestration protocol where agents collaborate in real-time to mitigate industrial alerts, perform technical resolution steps, and conduct strict safety audits before executing any containment commands.

---

## 🌟 Key Features
1. **Multi-Agent Orchestration Protocol:** Uses Band.ai for chat-based interaction and coordination between specialized agents.
2. **Robust Safety Audit Loop:** 
   - **Coordinator Agent:** Extracts target equipment names and context from incoming alerts.
   - **Systems Analyst:** Proposes technical containment steps based on the incident.
   - **Safety Auditor:** Strictly evaluates the proposed steps. If a step violates safety constraints, the Auditor issues a `SAFETY_AUDIT_REJECT:`, forcing the Analyst to revise the plan until full compliance is met.
3. **LLM-Based Reasoning:** Powered by Groq API for lightning-fast inference and high-reliability reasoning for technical containment.
4. **Structured Communication Flow:** Agents use explicit message headers (`TECHNICAL_RESOLUTION:`, `SAFETY_AUDIT_REJECT:`) with structured metadata payloads to bypass history-sync latency and ensure strict operational coordination.
5. **Modern Full-Stack Dashboard:** A responsive, dark-themed UI built with Next.js (Frontend) and FastAPI (Backend) for real-time monitoring of agent logs and incident states.

---

## 🛠️ Architecture & Tech Stack

* **Frontend:** Next.js (React, Tailwind CSS)
* **Backend:** FastAPI (Python)
* **Agent Framework:** Band SDK
* **LLM Provider:** Groq API (Llama 3 / Mixtral models)
* **Deployment:** Vercel (Frontend) & Render (Backend)

---

## 🚀 Local Development Setup

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/multi-ai-agent.git
cd multi-ai-agent
```

### 2. Backend Setup (FastAPI + Agents)
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create a `.env` file in the root directory:
```bash
cp .env.example .env
```
Fill in your API credentials:
* `GROQ_API_KEY`: Groq Cloud API Key
* `BAND_API_KEY`: Band.ai platform key
* `BAND_BOT_IDS`: Your registered Band agents.

Run the Backend Server:
```bash
python -m uvicorn api.index:app --host 127.0.0.1 --port 8000 --reload
```

Run the Swarm Agents (in a separate terminal):
```bash
source venv/bin/activate
python run_agents.py
```

### 3. Frontend Setup (Next.js)
```bash
npm install
npm run dev
```
Open `http://localhost:3000` to view the real-time agent dashboard.

---

## 🌐 Deployment Plan

* **Frontend (Vercel):** The Next.js application is configured to be easily deployed on Vercel with zero configuration. 
* **Backend (Render):** The FastAPI and Background Agent Runners can be deployed on Render using the provided `render.yaml` blueprint or Dockerfile. Ensure environment variables are securely added to the deployment settings.

---

## 📝 License
This project is open-source and available under the MIT License.
