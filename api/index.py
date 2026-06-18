import asyncio
import json
import os
import sys
import uuid
from datetime import datetime
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

# Add the current directory to python path for local imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from agents import trigger_incident_async
except ImportError:
    from api.agents import trigger_incident_async

app = FastAPI()

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

class TriggerPayload(BaseModel):
    alert_text: str
    delay: float = 0.1
    live_mode: bool = True

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
        record = {
            "id": str(uuid.uuid4())[:8],
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "alert_text": alert_text,
            "equipment": equipment,
            "status": status,
            "latency": latency,
            "logs": logs,
            "report": report
        }
        
        history_data = []
        if os.path.exists(HISTORY_PATH):
            try:
                with open(HISTORY_PATH, "r", encoding="utf-8") as f:
                    history_data = json.load(f)
            except Exception:
                pass
        
        history_data.insert(0, record)
        
        with open(HISTORY_PATH, "w", encoding="utf-8") as f:
            json.dump(history_data, f, indent=4, ensure_ascii=False)
    except Exception as e:
        print(f"Error logging history: {e}")

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
            coordinator = coordinator.replace("# Swarm Agent Definitions & Rules", "").strip()
            analyst = get_section(content, "## 2. Systems Analyst Agent", "## 3. Safety Auditor Agent")
            auditor = get_section(content, "## 3. Safety Auditor Agent", "## 4. Execution Agent")
            execution = get_section(content, "## 4. Execution Agent", "## 5. Forensic Investigator Agent")
            forensic = get_section(content, "## 5. Forensic Investigator Agent", "## 6. Knowledge Curator Agent")
            curator = get_section(content, "## 6. Knowledge Curator Agent")
        except Exception as e:
            print(f"Error parsing prompts: {e}")
            
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
            "# Swarm Agent Definitions & Rules\n\n"
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
        print(f"Error saving prompts: {e}")
        return False

@app.post("/api/trigger")
async def trigger_swarm(payload: TriggerPayload):
    """
    Streaming endpoint that runs the agent orchestration swarm, logs history,
    and yields progress updates in real-time using Server-Sent Events (SSE).
    """
    queue = asyncio.Queue()
    logs = []

    # The status callback will be invoked by the agents to push UI updates
    async def status_callback(agent: str, text: str):
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
                live_mode=payload.live_mode
            )
            status = "success"
            await queue.put({"type": "report", "report": report})
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
    asyncio.create_task(run_orchestrator())

    # Generator for SSE chunks
    async def sse_generator():
        while True:
            event = await queue.get()
            if event is None:
                break
            yield f"data: {json.dumps(event)}\n\n"

    return StreamingResponse(sse_generator(), media_type="text/event-stream")

# --- KNOWLEDGE BASE ENDPOINTS ---

@app.get("/api/blueprints")
async def get_blueprints():
    from mock_database import ENTERPRISE_KNOWLEDGE_BASE
    return ENTERPRISE_KNOWLEDGE_BASE._load()

@app.post("/api/blueprints")
async def save_blueprint(payload: BlueprintPayload):
    from mock_database import ENTERPRISE_KNOWLEDGE_BASE
    ENTERPRISE_KNOWLEDGE_BASE.update_spec(payload.name, payload.spec)
    return {"status": "ok"}

@app.delete("/api/blueprints/{name}")
async def delete_blueprint(name: str):
    from mock_database import ENTERPRISE_KNOWLEDGE_BASE
    ENTERPRISE_KNOWLEDGE_BASE.delete_spec(name)
    return {"status": "ok"}

@app.post("/api/scan-network")
async def scan_network():
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
        except Exception as e:
            await queue.put({"type": "error", "message": str(e)})
        finally:
            await queue.put(None)
            
    asyncio.create_task(run_scanner())
    
    async def sse_generator():
        while True:
            event = await queue.get()
            if event is None:
                break
            yield f"data: {json.dumps(event)}\n\n"
            
    return StreamingResponse(sse_generator(), media_type="text/event-stream")

# --- SYSTEM PROMPT ENDPOINTS ---

@app.get("/api/prompts")
async def get_prompts():
    return parse_prompts()

@app.post("/api/prompts")
async def post_prompts(payload: PromptsPayload):
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

# --- EQUIPMENT HEALTH & SIMULATION TELEMETRY ---

@app.get("/api/equipment")
async def get_equipment_status():
    from mock_database import ENTERPRISE_KNOWLEDGE_BASE
    blueprints = ENTERPRISE_KNOWLEDGE_BASE._load()
    
    # Load history to compute status
    history_data = []
    if os.path.exists(HISTORY_PATH):
        try:
            with open(HISTORY_PATH, "r", encoding="utf-8") as f:
                history_data = json.load(f)
        except Exception:
            pass
            
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
    history_data = []
    if os.path.exists(HISTORY_PATH):
        try:
            with open(HISTORY_PATH, "r", encoding="utf-8") as f:
                history_data = json.load(f)
        except Exception:
            pass
            
    record = next((r for r in history_data if r.get("id") == run_id), None)
    if not record:
        raise HTTPException(status_code=404, detail="Incident record not found")
        
    report_content = record.get("report", "No report available.")
    
    # Format a beautiful downloadable safety report document
    export_text = (
        f"# TechCare Swarm - Safety Incident Report\n"
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
async def reset_sandbox():
    try:
        # 1. Reset history.json
        with open(HISTORY_PATH, "w", encoding="utf-8") as f:
            f.write("[]")
            
        # 2. Reset database.json to defaults
        defaults = {
            "Vat 4": "TARGET: Chemical Mixing Vat 4\nCRITICAL THRESHOLD: 180°C\nPROTOCOL: If temperature exceeds 150°C, risk of thermal runaway is high.\nACTION 1: Do NOT dispatch human personnel to the floor.\nACTION 2: Immediately trigger auxiliary coolant loop valves.\nACTION 3: Command safe-state throttling to isolate the vat from the main\nassembly line.",
            "Server Rack B": "TARGET: Server Rack B (Financial Database)\nCRITICAL THRESHOLD: 85°C\nPROTOCOL: If ambient rack temperature exceeds 80°C, risk of data\ncorruption and hardware melting is imminent.\nACTION 1: Reroute active network traffic to Backup Rack C.\nACTION 2: Throttle Rack B CPU loads to 30%.\nACTION 3: Spin up emergency HVAC unit in Sector 4.",
            "Robotic Arm 9": "TARGET: Conveyor Robotic Arm 9\nCRITICAL FAULT: Motor Stalling / High Torque Resistance\nPROTOCOL: If arm stalls for more than 5 seconds, gear stripping or human\nobstruction is likely.\nACTION 1: Cut main power to Arm 9 immediately (E-Stop).\nACTION 2: Lock conveyor belt to prevent pile-up.\nACTION 3: Dispatch human maintenance crew with lockout/tagout gear for\nphysical inspection.",
            "Cooling Tower 2": "TARGET: Main Water Cooling Tower 2\nCRITICAL THRESHOLD: Flow rate < 10 L/s or Return Water Temp > 45°C\nPROTOCOL: If flow rate drops or temperature spikes, steam locks and boiler\nrupture are imminent.\nACTION 1: Open auxiliary loop bypass flow valves to 100%.\nACTION 2: Throttle steam turbine feed pressure to 40%.\nACTION 3: Inject chemical descaler into active cooling chambers.",
            "Main Generator Block A": "TARGET: Power Supply Main Generator Block A\nCRITICAL THRESHOLD: Frequency < 59.5 Hz or Frequency > 60.5 Hz\nPROTOCOL: Grid frequency instability risks damaging high-voltage factory machinery\nand inducing localized blackouts.\nACTION 1: Isolate Block A from the plant's active grid lines.\nACTION 2: Synchronize and start Backup Generator B.\nACTION 3: Shed non-essential factory zone loads (warehouse lights, HVAC).",
            "Pneumatic Press 7": "TARGET: Heavy Press Sector 3 (Pneumatic Press 7)\nCRITICAL FAULT: System pressure < 4 Bar or Light Curtain obstruction\nPROTOCOL: Insufficient pressure risks material deformation; light curtain breach\nindicates a severe operator crush hazard.\nACTION 1: Trigger physical locks on the pressing piston cylinder.\nACTION 2: Shut down raw component feed conveyor.\nACTION 3: Broadcast alarm signal and sirens in Sector 3."
        }
        
        from mock_database import DB_PATH
        with open(DB_PATH, "w", encoding="utf-8") as f:
            json.dump(defaults, f, indent=4, ensure_ascii=False)
            
        # 3. Reset prompt_rules.md to defaults
        default_prompts = (
            "# Swarm Agent Definitions & Rules\n\n"
            "## 1. Coordinator Agent\n"
            "**Role:** Operations Desk Manager.\n"
            "**Task:** You are the first point of contact for the TechCare Operations Swarm. When you receive a raw telemetry alert, perform the following tasks:\n"
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
            "   - `<containment_plan>`: Detail the exact step-by-step mitigation actions based ONLY on the database rules. For every action, include a corresponding verification method (e.g., \"Action: Trigger auxiliary cooling. Verification: Monitor coolant flow sensors\").\n"
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
            "  \"report\": \"Finalized incident report formatted as a professional Markdown document using these exact headers:\\n- **EXECUTIVE SUMMARY:** (Overview of the incident and target equipment)\\n- **IMPORTANT STEPS HIGHLIGHTED:** (Summary of the most critical automated intervention steps)\\n- **STEP-BY-STEP ACTION REQUIRED:** (Detailed manual/automated containment steps and LOTO procedures)\\n- **SAFETY PRECAUTIONS:** (Strict PPE checklists, isolation rules, and gas venting)\\n- **CONCLUSION:** (Post-containment status and sign-off)\"\n"
            "}\n"
            "```\n"
            "Mention the Execution Agent by ID to trigger containment.\n\n"
            "## 4. Execution Agent\n"
            "**Role:** Automated Systems Operator.\n"
            "**Task:** Receive the approved `INCIDENT_REPORT` from the Safety Auditor. Execute the containment actions specified in the report. Your tasks are:\n"
            "1. Parse the report and simulate executing each step of the containment plan on the mock system.\n"
            "2. For each step, output realistic status logs indicating actuator states, flow rates, and sensor feedback.\n"
            "   Format as a structured telemetry sequence:\n"
            "   ```text\n"
            "   [ACTUATOR_EXECUTION_LOG]\n"
            "   [STEP 1]: Command SENT -> [VALVE-AUX-COOLING] -> OPEN -> SUCCESS (100% open)\n"
            "   [STEP 1 FEEDBACK]: Flow rate stabilized at 45 L/s\n"
            "   [STEP 2]: Command SENT -> [THROTTLE-STATE] -> SAFE-ISOLATE -> SUCCESS\n"
            "   [TELEMETRY_STATUS]: Core Temperature cooling down: 195°C -> 183°C -> 172°C (STABILIZED below 180°C threshold)\n"
            "   ```\n"
            "3. Confirm that LOTO tags are verified and physical isolation has succeeded.\n"
            "4. Output the complete log prefixed with `EXECUTION_STATUS:`, and mention the Forensic Investigator by ID.\n\n"
            "## 5. Forensic Investigator Agent\n"
            "**Role:** Root Cause Analyst.\n"
            "**Task:** Receive the `EXECUTION_STATUS` from the Execution Agent. Review the entire chat history (including the initial alert, analyst's drafts, auditor's rejections/approvals, and execution logs). Perform a forensic investigation and output a detailed Root Cause Analysis (RCA) report prefixed with `FORENSIC_REPORT:` in professional markdown using these exact headers:\n"
            "- **INCIDENT CHRONOLOGY:** (Detailed timeline of events, from sensor exceedance to full containment, showing response lag)\n"
            "- **ROOT CAUSE CATEGORIZATION:** (Classify the core issue: e.g., Mechanical Failure, Sensor Drift, Software Fault, Human Error)\n"
            "- **FAILURE MODE ANALYSIS:** (Detailed technical explanation of how the fault triggered the telemetry spike)\n"
            "- **CONTAINMENT VERIFICATION:** (Analysis of why the Execution Agent's steps succeeded in stabilizing the system)\n"
            "- **LONG-TERM SYSTEMIC RECOMMENDATIONS:** (Physical hardware or procedural changes to prevent recurrence, e.g., installing redundant sensors or adjusting preventive maintenance schedules)\n"
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
            "   - `optimized_spec`: The complete, updated specification string incorporating the new guidelines.\n"
            "   - `changes_made`: A brief, high-level summary of the updates made to the database.\n"
            "Do not include the prefix 'LEARNING_SUMMARY:' in the completion body.\n"
        )
        
        with open(PROMPTS_PATH, "w", encoding="utf-8") as f:
            f.write(default_prompts)
            
        return {"status": "ok", "message": "Database and prompts restored to factory defaults."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Reset failed: {str(e)}")

# --- INCIDENT HISTORY & SYSTEM METRICS ENDPOINTS ---

@app.get("/api/history")
async def get_history():
    if os.path.exists(HISTORY_PATH):
        try:
            with open(HISTORY_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return []

@app.get("/api/metrics")
async def get_metrics():
    history_data = []
    if os.path.exists(HISTORY_PATH):
        try:
            with open(HISTORY_PATH, "r", encoding="utf-8") as f:
                history_data = json.load(f)
        except Exception:
            pass
            
    total_runs = len(history_data)
    if total_runs == 0:
        return {
            "total_runs": 0,
            "success_rate": 0,
            "avg_latency": 0,
            "alarms_by_equipment": {}
        }
        
    successes = sum(1 for r in history_data if r.get("status") == "success")
    success_rate = round((successes / total_runs) * 100, 1)
    
    total_latency = sum(r.get("latency", 0) for r in history_data)
    avg_latency = round(total_latency / total_runs, 2)
    
    alarms = {}
    for r in history_data:
        eq = r.get("equipment", "Unknown Equipment")
        alarms[eq] = alarms.get(eq, 0) + 1
        
    return {
        "total_runs": total_runs,
        "success_rate": success_rate,
        "avg_latency": avg_latency,
        "alarms_by_equipment": alarms
    }
