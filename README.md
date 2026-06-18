# 🤖 TechCare Ops Swarm

An automated, multi-agent industrial emergency incident containment system built on the **Band SDK** and **Groq API** for the **Band of Agents Hackathon (Lablab.ai)**.

---

## 🌟 Key Features
1.  **Industrial Triaging Swarm:** Coordinator Agent instantly extracts target equipment names from raw telemetry logs.
2.  **Compliance Guardrails:** Dedicated Systems Analyst looks up specs and safety thresholds from `ENTERPRISE_KNOWLEDGE_BASE`, and the Safety Auditor checks procedures against compliance laws.
3.  **Real-Time Dashboard:** A premium, dark-themed Streamlit UI detailing live agent status updates and structured compliance sign-offs.
4.  **Flexible Run Configurations:** Supports both a zero-setup local simulation sandbox and direct cloud integrations with `band.ai`.

---

## 🛠️ Installation & Setup

Ensure you have Python 3.11+ installed.

### 1. Initialize Virtual Environment
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Configure API Credentials
Create a `.env` file from the example:
```bash
cp .env.example .env
```
Open `.env` and fill in your details:
*   `GROQ_API_KEY`: Groq Cloud API Key (get it from [console.groq.com](https://console.groq.com/))
*   `BAND_API_KEY`: Your Band SDK platform key (from [app.band.ai](https://app.band.ai/))
*   `BAND_COORDINATOR_ID`, `BAND_ANALYST_ID`, `BAND_AUDITOR_ID`: UUIDs of your registered Band agents.

*Note: If no `BAND_API_KEY` is provided, the swarm automatically defaults to the **Local Simulation Sandbox**, allowing you to preview the full flow offline.*

---

## 🚀 Running the App
Start the Streamlit dashboard:
```bash
streamlit run app.py
```
A browser window will open at `http://localhost:8501`. Click on any emergency preset (like **Vat 4 Overheat**), and hit **Trigger Swarm Protocol**!

---

## 🏗️ Deployment to Streamlit Cloud
1.  **Push to GitHub:** Create a public GitHub repository named `techcare-ops-swarm` and push all code:
    ```bash
    git init
    git add .
    git commit -m "Initial release of TechCare Ops Swarm"
    git branch -M main
    git remote add origin [YOUR_GITHUB_REPO_URL]
    git push -u origin main
    ```
2.  **Deploy on Streamlit Cloud:** Go to [share.streamlit.io](https://share.streamlit.io/), log in, choose your repo, branch (`main`), and target file (`app.py`), and click **Deploy**.
3.  **Add Secrets:** Go to your Streamlit App settings -> **Secrets**, and paste your keys in TOML format:
    ```toml
    GROQ_API_KEY = "your-actual-groq-key"
    BAND_API_KEY = "your-actual-band-key"
    BAND_COORDINATOR_ID = "your-coordinator-uuid"
    BAND_ANALYST_ID = "your-analyst-uuid"
    BAND_AUDITOR_ID = "your-auditor-uuid"
    ```
