import asyncio
import json
import os
import sys
import uuid
import logging
from datetime import datetime
from fastapi import FastAPI, HTTPException, Request, Depends, Security
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

# Add the current directory to python path for local imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from agents import trigger_incident_async, invalidate_settings_cache, hitl_events, hitl_decisions
except ImportError:
    from api.agents import trigger_incident_async, invalidate_settings_cache, hitl_events, hitl_decisions

try:
    import db
except ImportError:
    from api import db

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("TechCareSafeGuardAPI")

# Rate Limiter
limiter = Limiter(key_func=get_remote_address)
app = FastAPI()
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Bearer Token Verification
security = HTTPBearer(auto_error=False)

async def verify_api_key(credentials: HTTPAuthorizationCredentials = Security(security)):
    secret_key = os.environ.get("API_SECRET_KEY")
    if not secret_key:
        return None
    if not credentials or credentials.credentials != secret_key:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")
    return credentials.credentials

@app.get("/")
def read_root():
    return {"status": "ok", "message": "TechCare SafeGuard API is running. Go to /docs for Swagger documentation."}

@app.on_event("startup")
async def startup_event():
    # Initialize SQLite database and run JSON migrations
    try:
        await db.init_db()
        logger.info("Database initialized successfully.")
    except Exception as e:
        logger.exception("Failed to initialize database:")

    # Only start background agents if explicitly requested (e.g. on Render production)
    if os.environ.get("START_BG_AGENTS") == "true":
        try:
            # Add parent directory of api to sys.path so we can import run_agents
            parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            if parent_dir not in sys.path:
                sys.path.append(parent_dir)
            
            import run_agents
            asyncio.create_task(run_agents.main())
            logger.info("Started persistent Band.ai agents runner task in the background.")
        except Exception as e:
            logger.error(f"Failed to start background agents runner: {e}")
    else:
        logger.info("Background agents runner skipped. Run 'python run_agents.py' manually to connect remote agents.")

# Configure CORS for frontend access
_frontend_url = os.environ.get("FRONTEND_URL", "")
_allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
if _frontend_url:
    _allowed_origins.append(_frontend_url)
    # Also allow the bare domain without trailing slash
    _allowed_origins.append(_frontend_url.rstrip("/"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins if _frontend_url else ["*"],
    allow_credentials=True,
    allow_headers=["*"],
    allow_methods=["*"],
)

# File paths
HISTORY_PATH = os.path.join(os.path.dirname(__file__), "history.json")
PROMPTS_PATH = os.path.join(os.path.dirname(__file__), "prompt_rules.md")
SETTINGS_PATH = os.path.join(os.path.dirname(__file__), "settings.json")

class TriggerPayload(BaseModel):
    alert_text: str = Field(..., min_length=5, max_length=2000, description="The telemetry alert text to evaluate.")
    delay: float = Field(0.1, ge=0.0, le=10.0, description="Delay between agent execution steps.")
    live_mode: bool = Field(True, description="Enable live Groq completions.")
    mock_mode: bool = Field(False, description="Enable simulated local mode.")

class BlueprintPayload(BaseModel):
    name: str
    spec: str

class PromptsPayload(BaseModel):
    coordinator: str
    analyst: str
    auditor: str
    execution: str
    forensic: str
    curator: str

# Helper: Save history record
async def save_history_record(alert_text, equipment, status, latency, logs, report):
    try:
        await db.save_history_record(alert_text, equipment, status, latency, logs, report)
    except Exception as e:
        logger.exception("Error logging history:")

# Helper: Parse prompt rules
def parse_prompts():
    coordinator = ""
    analyst = ""
    auditor = ""
    execution = ""
    forensic = ""
    curator = ""
    
    if os.path.exists(PROMPTS_PATH):
        try:
            with open(PROMPTS_PATH, "r", encoding="utf-8") as f:
                content = f.read()
            
            # Helper to split text by header markers
            def get_section(text, current_header, next_header=None):
                if current_header not in text:
                    return ""
                part = text.split(current_header, 1)[1]
                if next_header and next_header in part:
                    part = part.split(next_header, 1)[0]
                return part.strip()

            coordinator = get_section(content, "## 1. Coordinator Agent", "## 2. Systems Analyst Agent")
            # Clean up top header in coordinator part if present
            coordinator = coordinator.replace("# SafeGuard Agent Definitions & Rules", "").strip()
            analyst = get_section(content, "## 2. Systems Analyst Agent", "## 3. Safety Auditor Agent")
            auditor = get_section(content, "## 3. Safety Auditor Agent", "## 4. Execution Agent")
            execution = get_section(content, "## 4. Execution Agent", "## 5. Forensic Investigator Agent")
            forensic = get_section(content, "## 5. Forensic Investigator Agent", "## 6. Knowledge Curator Agent")
            curator = get_section(content, "## 6. Knowledge Curator Agent")
        except Exception as e:
            logger.exception("Error parsing prompts:")
            
    return {
        "coordinator": coordinator,
        "analyst": analyst,
        "auditor": auditor,
        "execution": execution,
        "forensic": forensic,
        "curator": curator
    }

# Helper: Save prompt rules
def save_prompts(coordinator, analyst, auditor, execution, forensic, curator):
    try:
        content = (
            "# SafeGuard Agent Definitions & Rules\n\n"
            "## 1. Coordinator Agent\n"
            f"{coordinator}\n\n"
            "## 2. Systems Analyst Agent\n"
            f"{analyst}\n\n"
            "## 3. Safety Auditor Agent\n"
            f"{auditor}\n\n"
            "## 4. Execution Agent\n"
            f"{execution}\n\n"
            "## 5. Forensic Investigator Agent\n"
            f"{forensic}\n\n"
            "## 6. Knowledge Curator Agent\n"
            f"{curator}\n"
        )
        with open(PROMPTS_PATH, "w", encoding="utf-8") as f:
            f.write(content)
        return True
    except Exception as e:
        logger.exception("Error saving prompts:")
        return False

@app.post("/api/trigger")
@limiter.limit("5/minute")
async def trigger_safeguard(request: Request, payload: TriggerPayload, authenticated: str = Depends(verify_api_key)):
    """
    Streaming endpoint that runs the agent orchestration SafeGuard, logs history,
    and yields progress updates in real-time using Server-Sent Events (SSE).
    """
    queue = asyncio.Queue()
    logs = []

    # The status callback will be invoked by the agents to push UI updates
    async def status_callback(agent: str, text: str):
        if text.startswith("HITL_AWAITING:"):
            parts = text.split("HITL_AWAITING:", 1)[1].split(":", 2)
            inc_id = parts[0]
            equip = parts[1]
            checklist = parts[2] if len(parts) > 2 else ""
            logs.append({"agent": agent, "text": f"PAUSED: Awaiting Operator Authorization for containment on {equip}..."})
            await queue.put({
                "type": "hitl_awaiting",
                "incident_id": inc_id,
                "equipment_name": equip,
                "proposed_checklist": checklist
            })
        elif text.startswith("REPORT_SAFETY:"):
            content = text.split("REPORT_SAFETY:", 1)[1]
            await queue.put({"type": "report_part", "part": "safety", "content": content})
        elif text.startswith("REPORT_EXECUTION:"):
            content = text.split("REPORT_EXECUTION:", 1)[1]
            await queue.put({"type": "report_part", "part": "execution", "content": content})
        elif text.startswith("REPORT_DETECTIVE:"):
            content = text.split("REPORT_DETECTIVE:", 1)[1]
            await queue.put({"type": "report_part", "part": "detective", "content": content})
        elif text.startswith("REPORT_KNOWLEDGE:"):
            content = text.split("REPORT_KNOWLEDGE:", 1)[1]
            await queue.put({"type": "report_part", "part": "knowledge", "content": content})
        else:
            logs.append({"agent": agent, "text": text})
            await queue.put({"type": "log", "agent": agent, "text": text})

    # Run the orchestrator in a background task
    async def run_orchestrator():
        import time
        start_time = time.time()
        status = "failed"
        report = ""
        error_msg = ""
        
        try:
            report = await trigger_incident_async(
                alert_text=payload.alert_text,
                status_callback=status_callback,
                delay=payload.delay,
                live_mode=payload.live_mode,
                mock_mode=payload.mock_mode
            )
            status = "success"
            await queue.put({"type": "report", "report": report})
        except asyncio.CancelledError:
            logger.info("Orchestrator task cancelled due to client disconnect")
            status = "cancelled"
            error_msg = "Execution cancelled by client disconnect"
            raise
        except Exception as e:
            error_msg = str(e)
            await queue.put({"type": "error", "message": error_msg})
        finally:
            latency = round(time.time() - start_time, 2)
            
            # Identify equipment from logs
            equipment = "Unknown Equipment"
            for log in logs:
                if "Identified equipment:" in log["text"]:
                    try:
                        equipment = log["text"].split("Identified equipment: **")[1].split("**")[0]
                    except Exception:
                        pass
                    break
            
            # Save to history database
            await save_history_record(
                alert_text=payload.alert_text,
                equipment=equipment,
                status=status,
                latency=latency,
                logs=logs,
                report=report if status == "success" else error_msg
            )
            
            # Put None as a sentinel value to signal the generator to stop streaming
            await queue.put(None)

    # Launch task
    orchestrator_task = asyncio.create_task(run_orchestrator())

    # Generator for SSE chunks with disconnect checking and task cancellation
    async def sse_generator():
        try:
            while True:
                if await request.is_disconnected():
                    logger.warning("Client disconnected from SSE stream. Initiating cleanup...")
                    break
                
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=1.0)
                    if event is None:
                        break
                    yield f"data: {json.dumps(event)}\n\n"
                except asyncio.TimeoutError:
                    continue
        except asyncio.CancelledError:
            logger.warning("SSE generator task cancelled")
        finally:
            if not orchestrator_task.done():
                logger.warning("Client disconnected while orchestrator was running. Cancelling orchestrator task...")
                orchestrator_task.cancel()
                try:
                    await orchestrator_task
                except asyncio.CancelledError:
                    pass

    return StreamingResponse(
        sse_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

# --- HUMAN-IN-THE-LOOP (HITL) ENDPOINTS ---

@app.post("/api/hitl/approve")
async def hitl_approve(payload: dict, authenticated: str = Depends(verify_api_key)):
    incident_id = payload.get("incident_id")
    if not incident_id or incident_id not in hitl_events:
        raise HTTPException(status_code=404, detail="Incident not found or already processed")
    hitl_decisions[incident_id] = "approved"
    hitl_events[incident_id].set()
    logger.info(f"HITL Incident {incident_id} approved by user.")
    return {"status": "approved"}

@app.post("/api/hitl/decline")
async def hitl_decline(payload: dict, authenticated: str = Depends(verify_api_key)):
    incident_id = payload.get("incident_id")
    if not incident_id or incident_id not in hitl_events:
        raise HTTPException(status_code=404, detail="Incident not found or already processed")
    hitl_decisions[incident_id] = "declined"
    hitl_events[incident_id].set()
    logger.info(f"HITL Incident {incident_id} declined by user.")
    return {"status": "declined"}

# --- KNOWLEDGE BASE ENDPOINTS ---

@app.get("/api/blueprints")
async def get_blueprints():
    from dynamic_db import ENTERPRISE_KNOWLEDGE_BASE
    return ENTERPRISE_KNOWLEDGE_BASE._load()

@app.post("/api/blueprints")
async def save_blueprint(payload: BlueprintPayload, authenticated: str = Depends(verify_api_key)):
    from dynamic_db import ENTERPRISE_KNOWLEDGE_BASE
    ENTERPRISE_KNOWLEDGE_BASE.update_spec(payload.name, payload.spec)
    return {"status": "ok"}

@app.delete("/api/blueprints/{name}")
async def delete_blueprint(name: str, authenticated: str = Depends(verify_api_key)):
    from dynamic_db import ENTERPRISE_KNOWLEDGE_BASE
    ENTERPRISE_KNOWLEDGE_BASE.delete_spec(name)
    return {"status": "ok"}

@app.post("/api/scan-network")
@limiter.limit("5/minute")
async def scan_network(request: Request, authenticated: str = Depends(verify_api_key)):
    """
    Simulates scanning the plant network and auto-ingesting blueprints,
    streaming progress logs in real-time.
    """
    from network_scanner import simulate_network_scan_async
    
    queue = asyncio.Queue()
    
    async def status_callback(agent: str, text: str):
        await queue.put({"type": "log", "agent": agent, "text": text})
        
    async def run_scanner():
        try:
            results = await simulate_network_scan_async(status_callback=status_callback)
            await queue.put({"type": "results", "results": results})
        except asyncio.CancelledError:
            logger.info("Network scanner task cancelled due to client disconnect")
            raise
        except Exception as e:
            await queue.put({"type": "error", "message": str(e)})
        finally:
            await queue.put(None)
            
    scanner_task = asyncio.create_task(run_scanner())
    
    async def sse_generator():
        try:
            while True:
                if await request.is_disconnected():
                    logger.warning("Client disconnected from scan network SSE stream. Initiating cleanup...")
                    break
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=1.0)
                    if event is None:
                        break
                    yield f"data: {json.dumps(event)}\n\n"
                except asyncio.TimeoutError:
                    continue
        except asyncio.CancelledError:
            logger.warning("Scan SSE generator task cancelled")
        finally:
            if not scanner_task.done():
                logger.warning("Client disconnected while scanning was running. Cancelling scanner task...")
                scanner_task.cancel()
                try:
                    await scanner_task
                except asyncio.CancelledError:
                    pass
            
    return StreamingResponse(
        sse_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

# --- SYSTEM PROMPT ENDPOINTS ---

@app.get("/api/prompts")
async def get_prompts():
    return parse_prompts()

BACKUP_DIR = os.path.join(os.path.dirname(__file__), "prompts_backup")

@app.post("/api/prompts")
async def post_prompts(payload: PromptsPayload, authenticated: str = Depends(verify_api_key)):
    # 1. Validate fields are not empty
    if not payload.coordinator.strip() or not payload.analyst.strip() or not payload.auditor.strip() or not payload.execution.strip() or not payload.forensic.strip() or not payload.curator.strip():
        raise HTTPException(status_code=400, detail="Cannot save prompts: one or more agent sections are empty")

    # 2. Validate that the combined text contains all six mandatory agent markdown headers
    reconstructed_content = (
        "# SafeGuard Agent Definitions & Rules\n\n"
        "## 1. Coordinator Agent\n"
        f"{payload.coordinator}\n\n"
        "## 2. Systems Analyst Agent\n"
        f"{payload.analyst}\n\n"
        "## 3. Safety Auditor Agent\n"
        f"{payload.auditor}\n\n"
        "## 4. Execution Agent\n"
        f"{payload.execution}\n\n"
        "## 5. Forensic Investigator Agent\n"
        f"{payload.forensic}\n\n"
        "## 6. Knowledge Curator Agent\n"
        f"{payload.curator}\n"
    )
    
    required_headers = [
        "## 1. Coordinator Agent",
        "## 2. Systems Analyst Agent",
        "## 3. Safety Auditor Agent",
        "## 4. Execution Agent",
        "## 5. Forensic Investigator Agent",
        "## 6. Knowledge Curator Agent"
    ]
    missing = [h for h in required_headers if h not in reconstructed_content]
    if missing:
        raise HTTPException(status_code=400, detail=f"Cannot save prompts: missing mandatory headers: {', '.join(missing)}")

    # 3. Make backup of current prompts
    if os.path.exists(PROMPTS_PATH):
        try:
            os.makedirs(BACKUP_DIR, exist_ok=True)
            timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            backup_path = os.path.join(BACKUP_DIR, f"{timestamp}_prompt_rules.md")
            with open(PROMPTS_PATH, "r", encoding="utf-8") as src:
                current_content = src.read()
            with open(backup_path, "w", encoding="utf-8") as dst:
                dst.write(current_content)
        except Exception as e:
            logger.exception("Failed to create prompt backup:")

    # 4. Save prompts
    success = save_prompts(
        payload.coordinator,
        payload.analyst,
        payload.auditor,
        payload.execution,
        payload.forensic,
        payload.curator
    )
    if not success:
        raise HTTPException(status_code=500, detail="Failed to save prompts")
    return {"status": "ok"}

# --- GLOBAL SYSTEM CONFIGURATION & SETTINGS ENDPOINTS ---

@app.get("/api/settings")
async def get_settings():
    if os.path.exists(SETTINGS_PATH):
        try:
            with open(SETTINGS_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                # Map legacy models to currently supported dropdown values
                models = data.get("models", {})
                for k, v in list(models.items()):
                    if v == "llama3-70b-8192":
                        models[k] = "llama-3.3-70b-versatile"
                return data
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to read settings: {str(e)}")
    return {}

@app.post("/api/settings")
async def update_settings(payload: dict, authenticated: str = Depends(verify_api_key)):
    try:
        existing = {}
        if os.path.exists(SETTINGS_PATH):
            try:
                with open(SETTINGS_PATH, "r", encoding="utf-8") as f:
                    existing = json.load(f)
            except Exception:
                pass
        for k, v in payload.items():
            existing[k] = v
        with open(SETTINGS_PATH, "w", encoding="utf-8") as f:
            json.dump(existing, f, indent=4, ensure_ascii=False)
        invalidate_settings_cache()
        return existing
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save settings: {str(e)}")

@app.get("/api/prompts/history")
async def get_prompts_history():
    """Lists available prompt backups."""
    if not os.path.exists(BACKUP_DIR):
        return []
    try:
        backups = []
        for file in sorted(os.listdir(BACKUP_DIR), reverse=True):
            if file.endswith("_prompt_rules.md"):
                parts = file.split("_")
                date_str = parts[0]
                time_str = parts[1]
                formatted_time = f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:]} {time_str[:2]}:{time_str[2:4]}:{time_str[4:6]} UTC"
                backups.append({
                    "filename": file,
                    "timestamp": formatted_time
                })
        return backups
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list backups: {str(e)}")

class RollbackPayload(BaseModel):
    filename: str

@app.post("/api/prompts/rollback")
async def rollback_prompts(payload: RollbackPayload, authenticated: str = Depends(verify_api_key)):
    """Rolls back prompt_rules.md to a backup file."""
    target_path = os.path.join(BACKUP_DIR, payload.filename)
    if not os.path.exists(target_path):
        raise HTTPException(status_code=404, detail="Backup file not found")
    try:
        with open(target_path, "r", encoding="utf-8") as f:
            backup_content = f.read()

        required_headers = [
            "## 1. Coordinator Agent",
            "## 2. Systems Analyst Agent",
            "## 3. Safety Auditor Agent",
            "## 4. Execution Agent",
            "## 5. Forensic Investigator Agent",
            "## 6. Knowledge Curator Agent"
        ]
        missing = [h for h in required_headers if h not in backup_content]
        if missing:
            raise HTTPException(status_code=400, detail=f"Cannot rollback: Backup file is missing mandatory sections: {', '.join(missing)}")

        with open(PROMPTS_PATH, "w", encoding="utf-8") as f:
            f.write(backup_content)

        return {"status": "ok", "message": "Prompts rolled back successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Rollback failed: {str(e)}")

# --- EQUIPMENT HEALTH & SIMULATION TELEMETRY ---

@app.get("/api/equipment")
async def get_equipment_status():
    from dynamic_db import ENTERPRISE_KNOWLEDGE_BASE
    blueprints = ENTERPRISE_KNOWLEDGE_BASE._load()
    
    # Load history to compute status from database
    try:
        history_data = await db.get_history(page=1, limit=1000)
    except Exception:
        history_data = []
            
    result = []
    current_time = datetime.utcnow()
    
    for name, spec in blueprints.items():
        # Filter incidents for this equipment
        incidents = [r for r in history_data if r.get("equipment") == name]
        count = len(incidents)
        
        # Calculate health score: start at 100
        health = 100
        last_time_str = "N/A"
        is_critical = False
        
        if incidents:
            # Sort by timestamp (newest first)
            incidents.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
            latest = incidents[0]
            last_time_str = latest.get("timestamp", "N/A")
            
            # Deduct health per recent incident
            for inc in incidents[:5]:  # only consider last 5 incidents
                if inc.get("status") == "success":
                    health -= 15
                else:
                    health -= 40
            health = max(health, 10)
            
            # Check if latest was very recent (within last 10 minutes)
            try:
                ts_str = latest.get("timestamp", "").replace("Z", "")
                dt = datetime.fromisoformat(ts_str)
                delta = (current_time - dt).total_seconds()
                if delta < 600:  # < 10 mins
                    is_critical = True
            except Exception:
                pass
                
            if latest.get("status") != "success":
                is_critical = True
                
        # Determine status
        if is_critical or health < 50:
            status = "CRITICAL"
        elif count > 0 or health < 85:
            status = "WARNING"
        else:
            status = "HEALTHY"
            
        result.append({
            "name": name,
            "status": status,
            "health_score": health,
            "incidents_count": count,
            "last_incident": last_time_str,
            "spec_summary": spec.split("\n")[1] if len(spec.split("\n")) > 1 else spec
        })
        
    return result

# --- EXPORT INCIDENT REPORT ---

@app.get("/api/history/{run_id}/export")
async def export_report(run_id: str):
    try:
        record = await db.get_history_by_id(run_id)
    except Exception as e:
        logger.exception("Failed to fetch history record for export:")
        raise HTTPException(status_code=500, detail=f"Failed to fetch record: {str(e)}")
        
    if not record:
        raise HTTPException(status_code=404, detail="Incident record not found")
        
    report_content = record.get("report", "No report available.")
    
    # Format a beautiful downloadable safety report document
    export_text = (
        f"# TechCare SafeGuard - Safety Incident Report\n"
        f"**Run ID:** {record.get('id')}\n"
        f"**Timestamp:** {record.get('timestamp')}\n"
        f"**Target System:** {record.get('equipment')}\n"
        f"**Raw Alert:** {record.get('alert_text')}\n"
        f"**Orchestration Latency:** {record.get('latency')} seconds\n"
        f"**Status:** {record.get('status').upper()}\n\n"
        f"---\n\n"
        f"{report_content}\n"
    )
    
    from fastapi.responses import Response
    return Response(
        content=export_text,
        media_type="text/markdown",
        headers={
            "Content-Disposition": f"attachment; filename=incident_report_{run_id}.md"
        }
    )

# --- RESET SANDBOX ENDPOINT ---

@app.post("/api/reset")
async def reset_sandbox(authenticated: str = Depends(verify_api_key)):
    try:
        # 1. Reset history table in SQLite
        await db.clear_history()
        await db.migrate_history()
            
        # 2. Reset blueprints database to defaults in SQLite by clearing and running migrations
        await db.clear_blueprints()
        await db.migrate_blueprints()
            
        # 3. Reset prompt_rules.md to defaults
        default_prompts = (
            "# SafeGuard Agent Definitions & Rules\n\n"
            "## 1. Coordinator Agent\n"
            "**Role:** Operations Desk Manager.\n"
            "**Task:** You are the first point of contact for the TechCare Operations SafeGuard. When you receive a raw telemetry alert, perform the following tasks:\n"
            "1. Parse the alert text to extract:\n"
            "   - Target Equipment (e.g., \"Chemical Mixing Vat 4\")\n"
            "   - Violated Metric & Current Value (e.g., \"Temperature spiked to 195°C\")\n"
            "   - Gravity/Severity (e.g., \"Critical\")\n"
            "2. If the equipment name is ambiguous or missing, request the Systems Analyst to verify it using the active equipment list.\n"
            "3. Open the incident chat room and dispatch the parsed alert. Prefix your message with `INCIDENT_ALERT:` followed by a JSON payload:\n"
            "   ```json\n"
            "   {\n"
            "     \"equipment\": \"Equipment Name\",\n"
            "     \"metric\": \"Metric Name\",\n"
            "     \"current_value\": \"Value\",\n"
            "     \"raw_alert\": \"Original Alert Text\"\n"
            "   }\n"
            "   ```\n"
            "4. Mention the Systems Analyst by ID to trigger the next step. Do not attempt to solve the problem yourself.\n\n"
            "## 2. Systems Analyst Agent\n"
            "**Role:** Lead Technical Engineer.\n"
            "**Task:** Receive the alert from the Coordinator. Your tasks are:\n"
            "1. Look up the matching equipment in the `ENTERPRISE_KNOWLEDGE_BASE`.\n"
            "2. Extract the critical safety thresholds and automated procedures.\n"
            "3. Format your response into structured reasoning sections using these tags:\n"
            "   - `<diagnostics>`: Compare the current telemetry value with the critical database threshold. Quantify the exceedance (e.g., \"Temp is 15°C above the 180°C limit\"). List potential failure modes (sensor drift, system load, etc.).\n"
            "   - `<containment_plan>`: Detail the exact step-by-step mitigation actions based ONLY on the database rules. In your containment plan, you MUST strictly satisfy the Safety Auditor's compliance checklist. Follow these format and content requirements:\n"
            "      a. Reference the exact critical thresholds from the knowledge base.\n"
            "      b. Follow the exact action sequence outlined in the database rules in order (e.g., ACTION 1, then ACTION 2, then ACTION 3).\n"
            "      c. For every single action step, you MUST include a corresponding verification method. Write each step strictly in this format:\n"
            "         - **Step [N]**: Action: [Mitigation step detail, including specific PPE requirements like heat-resistant gloves and safety glasses if there is human intervention, and LOTO procedures if there is electrical isolation/maintenance]. Verification: [Concrete method to verify the action succeeded].\n"
            "         Example:\n"
            "         - **Step 1**: Action: Automatically reduce mixing speed by 50% to prevent further heat generation. Verification: Check mixing speed tachometer readings.\n"
            "         - **Step 2**: Action: Isolate power supply to the mixing vat and apply lockout/tagout (LOTO) tags to the breaker. Verification: Verify zero voltage on the main power feed.\n"
            "      d. Explicitly verify electrical/mechanical isolation before any maintenance, physical inspection, or repair step.\n"
            "      e. Always specify proper PPE (Personal Protective Equipment) requirements (such as heat-resistant gloves, safety glasses, face shields, or fire-resistant gear) for each hazardous step involving human intervention (or explicitly state: \"No PPE required as all actions are completely automated\").\n"
            "      f. Always include explicit lockout/tagout (LOTO) procedures for any electrical isolation, power disconnection, or mechanical lock steps.\n"
            "      g. Specify post-action verification and monitoring to confirm containment success.\n"
            "4. Prefix your output with `TECHNICAL_RESOLUTION:` followed by your structured containment plan, and mention the Safety Auditor by ID.\n"
            "5. If the Safety Auditor rejects your proposed resolution (`SAFETY_AUDIT_REJECT`), analyze the feedback, revise your technical steps to rectify the safety violations, and submit a revised resolution.\n\n"
            "## 3. Safety Auditor Agent\n"
            "**Role:** Compliance Inspector.\n"
            "**Task:** Review the Analyst's resolution. Ensure it strictly follows the safety protocols. You must perform safety verification checking for:\n"
            "1. **PPE Checklist:** Ensure appropriate personal protective equipment is specified if any human entry or physical maintenance is required.\n"
            "2. **LOTO (Lockout/Tagout):** Verify physical power isolation is executed and checked before any physical or mechanical repairs.\n"
            "3. **Environmental Auditing:** Ensure ventilation, pressure relief, and gas venting are verified before human dispatch.\n"
            "4. **Containment Verification:** Verify that every proposed containment step has an explicit verification method.\n"
            "You must output your audit result as a JSON object in one of these two formats:\n\n"
            "If safety violations are detected:\n"
            "```json\n"
            "{\n"
            "  \"safe\": false,\n"
            "  \"feedback\": \"Details of the safety violations and clear instructions on what needs to be changed.\",\n"
            "  \"report\": \"\"\n"
            "}\n"
            "```\n\n"
            "If the resolution is fully safe and compliant:\n"
            "```json\n"
            "{\n"
            "  \"safe\": true,\n"
            "  \"feedback\": \"\",\n"
            "  \"report\": \"Finalized incident report formatted as an extremely concise Markdown document. Limit each section to a maximum of 1-2 bullet points or short sentences, focusing only on the absolute essentials and important details. Do not use built-in emojis in titles/headers. Use these exact headers:\\n- **EXECUTIVE SUMMARY:** (Brief overview)\\n- **IMPORTANT STEPS HIGHLIGHTED:** (Top critical actions)\\n- **STEP-BY-STEP ACTION REQUIRED:** (Short steps and LOTO)\\n- **SAFETY PRECAUTIONS:** (Essential precautions)\\n- **CONCLUSION:** (Short sign-off)\"\n"
            "}\n"
            "```\n"
            "Mention the Execution Agent by ID to trigger containment.\n\n"
            "## 4. Execution Agent\n"
            "**Role:** Automated Systems Operator.\n"
            "**Task:** Receive the approved `INCIDENT_REPORT` from the Safety Auditor. Execute the containment actions specified in the report. Your tasks are:\n"
            "1. Parse the report and simulate executing each step of the containment plan on the mock system.\n"
            "2. For each step, output a single-line status log. Keep the status output extremely concise and simple:\n"
            "   Format as a structured telemetry sequence:\n"
            "   ```text\n"
            "   [ACTUATOR_EXECUTION_LOG]\n"
            "   [STEP 1]: VALVE-AUX-COOLING -> OPEN -> SUCCESS\n"
            "   [STEP 2]: THROTTLE-STATE -> SAFE-ISOLATE -> SUCCESS\n"
            "   [TELEMETRY_STATUS]: Temperature stabilized below threshold\n"
            "   ```\n"
            "3. Confirm that LOTO tags are verified and physical isolation has succeeded.\n"
            "4. Output the complete log prefixed with `EXECUTION_STATUS:`, and mention the Forensic Investigator by ID.\n\n"
            "## 5. Forensic Investigator Agent\n"
            "**Role:** Root Cause Analyst.\n"
            "**Task:** Receive the `EXECUTION_STATUS` from the Execution Agent. Review the entire chat history (including the initial alert, analyst's drafts, auditor's rejections/approvals, and execution logs). Perform a forensic investigation and output a highly concise Root Cause Analysis (RCA) report prefixed with `FORENSIC_REPORT:` in professional markdown using these exact headers (limit each section to a maximum of 1-2 bullet points or short sentences):\n"
            "- **INCIDENT CHRONOLOGY:** (Brief timeline summary)\n"
            "- **ROOT CAUSE CATEGORIZATION:** (Category only)\n"
            "- **FAILURE MODE ANALYSIS:** (Brief technical explanation)\n"
            "- **CONTAINMENT VERIFICATION:** (Why it worked)\n"
            "- **LONG-TERM SYSTEMIC RECOMMENDATIONS:** (Key action items to prevent recurrence)\n"
            "- **FORENSIC SIGN-OFF:** (RCA validator signature)\n"
            "Pass the forensic report to the Knowledge Curator.\n\n"
            "## 6. Knowledge Curator Agent\n"
            "**Role:** Feedback & Learning Agent.\n"
            "**Task:** Receive the `FORENSIC_REPORT` from the Forensic Investigator. Analyze the RCA report to extract key learnings, new failure modes, safety threshold adjustments, or preventative actions.\n"
            "Your instructions are:\n"
            "1. Carefully read the Forensic RCA Report and identify why the containment action was required.\n"
            "2. Formulate an optimized version of the equipment specification. Retain the existing specifications, but enrich them by dynamically adding:\n"
            "   - Specific failure symptoms and threshold exceedance reasons under `CAUTION_WARNING`.\n"
            "   - Long-term preventative maintenance steps under `PREVENTATIVE_ACTIONS`.\n"
            "   - Explicit steps to verify containment success under `CONTAINMENT_VERIFICATION`.\n"
            "3. You must output a JSON object containing two fields:\n"
            "   - `optimized_spec`: The complete, updated specification string incorporating the new guidelines. Keep the additions extremely concise (1-2 sentences/bullets per field).\n"
            "   - `changes_made`: A brief, high-level summary of the updates made to the database.\n"
            "Do not include the prefix 'LEARNING_SUMMARY:' in the completion body.\n"
        )
        
        with open(PROMPTS_PATH, "w", encoding="utf-8") as f:
            f.write(default_prompts)
            
        # 4. Reset settings.json to defaults
        default_settings = {
            "company_name": "TechCare SafeGuard",
            "facility_name": "Containment Facility Sector 4",
            "safety_officer_email": "safety@techcare.internal",
            "dark_mode": False,
            "models": {
                "coordinator": "llama-3.1-8b-instant",
                "analyst": "llama-3.3-70b-versatile",
                "auditor": "llama-3.3-70b-versatile",
                "execution": "llama-3.1-8b-instant",
                "forensic": "llama-3.3-70b-versatile",
                "curator": "llama-3.1-8b-instant"
            },
            "temperatures": {
                "coordinator": 0.0,
                "analyst": 0.0,
                "auditor": 0.0,
                "execution": 0.0,
                "forensic": 0.0,
                "curator": 0.2
            },
            "max_tokens": {
                "coordinator": 80,
                "analyst": 450,
                "auditor": 450,
                "execution": 450,
                "forensic": 450,
                "curator": 450
            },
            "cost_tracker": {
                "total_tokens": 0,
                "total_cost": 0.0
            }
        }
        with open(SETTINGS_PATH, "w", encoding="utf-8") as f:
            json.dump(default_settings, f, indent=4, ensure_ascii=False)
            
        invalidate_settings_cache()
        return {"status": "ok", "message": "Database, settings, and prompts restored to factory defaults."}
    except Exception as e:
        logger.exception("Reset failed:")
        raise HTTPException(status_code=500, detail=f"Reset failed: {str(e)}")

# --- INCIDENT HISTORY & SYSTEM METRICS ENDPOINTS ---

@app.get("/api/history")
async def get_history(page: int = 1, limit: int = 50):
    try:
        return await db.get_history(page=page, limit=limit)
    except Exception as e:
        logger.exception("Failed to get history:")
        raise HTTPException(status_code=500, detail=f"Failed to get history: {str(e)}")

@app.get("/api/metrics")
async def get_metrics():
    try:
        return await db.get_metrics()
    except Exception as e:
        logger.exception("Failed to get metrics:")
        raise HTTPException(status_code=500, detail=f"Failed to get metrics: {str(e)}")
