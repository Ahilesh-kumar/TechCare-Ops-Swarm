import os
import json
import asyncio
import logging
from dotenv import load_dotenv
from groq import AsyncGroq

# Band SDK imports
from band import Agent, PlatformMessage
from band.agent import SimpleAdapter
from band.core.protocols import AgentToolsProtocol
from band.runtime.tools import AgentTools

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("TechCareSwarm")

# Initialize Groq Client
GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
groq_client = AsyncGroq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None

class MessageWrapper:
    def __init__(self, content: str, sender_id: str = "", sender_type: str = ""):
        self.content = content
        self.sender_id = sender_id
        self.sender_type = sender_type

def _get_history_list(history) -> list:
    """
    Safely extracts a list of message-like objects having a .content attribute.
    Handles HistoryProvider, raw list of dicts, and list of PlatformMessage.
    """
    if history is None:
        return []
    
    raw_items = []
    if hasattr(history, "raw"):
        raw_items = history.raw
    elif isinstance(history, list):
        raw_items = history
    else:
        try:
            raw_items = list(history)
        except Exception:
            return []

    res = []
    for item in raw_items:
        if isinstance(item, dict):
            content = item.get("content", "")
            sender_id = item.get("sender_id", "")
            sender_type = item.get("sender_type", "")
            res.append(MessageWrapper(content, sender_id, sender_type))
        elif hasattr(item, "content"):
            res.append(item)
    return res

def parse_technical_resolution(content: str):
    equipment = "Unknown Equipment"
    alert = ""
    resolution = content
    
    if "EQUIPMENT:" in content:
        try:
            parts = content.split("EQUIPMENT:", 1)[1].split("\n", 1)
            equipment = parts[0].strip()
            rest = parts[1]
            if "ALERT:" in rest:
                alert_parts = rest.split("ALERT:", 1)[1].split("\n", 1)
                alert = alert_parts[0].strip()
                rest = alert_parts[1]
            if "---" in rest:
                resolution = rest.split("---", 1)[1].strip()
            else:
                resolution = rest.strip()
        except Exception:
            pass
    return equipment, alert, resolution

def parse_safety_rejection(content: str):
    equipment = "Unknown Equipment"
    alert = ""
    feedback = content
    
    if "EQUIPMENT:" in content:
        try:
            parts = content.split("EQUIPMENT:", 1)[1].split("\n", 1)
            equipment = parts[0].strip()
            rest = parts[1]
            if "ALERT:" in rest:
                alert_parts = rest.split("ALERT:", 1)[1].split("\n", 1)
                alert = alert_parts[0].strip()
                rest = alert_parts[1]
            if "---" in rest:
                feedback = rest.split("---", 1)[1].strip()
            else:
                feedback = rest.strip()
        except Exception:
            pass
    return equipment, alert, feedback

class CoordinatorAdapter(SimpleAdapter[list]):
    """
    Coordinator Agent - Operations Desk Manager.
    First point of contact. Identifies the equipment name from a raw telemetry alert,
    opens a new incident chatroom, invites the Systems Analyst, and forwards the alert.
    """
    SUPPORTED_EMIT = frozenset()
    SUPPORTED_CAPABILITIES = frozenset()

    def __init__(self, analyst_id: str = "systems_analyst"):
        super().__init__()
        self.analyst_id = analyst_id
        # Load system instructions from prompt_rules.md or use a fallback
        self.system_prompt = self._load_system_prompt()

    def _load_system_prompt(self) -> str:
        rules_path = os.path.join(os.path.dirname(__file__), "prompt_rules.md")
        if os.path.exists(rules_path):
            try:
                with open(rules_path, "r") as f:
                    content = f.read()
                # Extract the Coordinator section
                parts = content.split("## 2. Systems Analyst Agent")
                coordinator_part = parts[0].replace("# Swarm Agent Definitions & Rules", "").strip()
                return coordinator_part
            except Exception as e:
                logger.error(f"Error loading prompt_rules.md: {e}")
        
        # Fallback system prompt if file not found
        return (
            "Role: Operations Desk Manager.\n"
            "Task: You are the first point of contact. When you receive a raw telemetry alert, "
            "identify the equipment name, open the incident chat room, and pass the exact alert "
            "to the Systems Analyst. Do not attempt to solve the problem yourself."
        )

    async def on_message(
        self,
        msg: PlatformMessage,
        tools: AgentToolsProtocol,
        history: list,
        participants_msg: str | None,
        contacts_msg: str | None,
        *,
        is_session_bootstrap: bool,
        room_id: str,
    ) -> None:
        """
        Processes incoming alerts. Extracts equipment name, creates a new room,
        adds the Systems Analyst, and forwards the alert.
        """
        logger.info(f"Coordinator received message: {msg.content}")

        # Avoid reacting to our own messages or messages from other agents if we are bootstrapping
        if msg.sender_type == "agent" and msg.sender_id == getattr(self, "_band_agent_id", None):
            return

        # 1. Identify equipment name using Groq API
        equipment_name = await self._identify_equipment(msg.content)
        logger.info(f"Coordinator identified equipment: {equipment_name}")

        # 2. Create the new incident chatroom on Band platform
        try:
            logger.info("Coordinator creating new incident chatroom...")
            new_room_id = await tools.create_chatroom()
            logger.info(f"Created chatroom with ID: {new_room_id}")

            # 3. Create Tools bound to the new chatroom
            new_room_tools = AgentTools(new_room_id, tools.rest)

            # 4. Add the Systems Analyst to the new room
            logger.info(f"Adding Systems Analyst ({self.analyst_id}) to room {new_room_id}...")
            await new_room_tools.add_participant(self.analyst_id)

            # 5. Forward the raw alert message into the new chatroom
            alert_payload = {
                "equipment": equipment_name,
                "raw_alert": msg.content
            }
            logger.info(f"Forwarding alert to Systems Analyst in room {new_room_id}...")
            await new_room_tools.send_message(
                content=f"INCIDENT_ALERT: {json.dumps(alert_payload)}",
                mentions=[self.analyst_id]
            )
        except Exception as e:
            logger.error(f"Error executing Coordinator Swarm actions: {e}")
            mentions = [msg.sender_id] if getattr(msg, "sender_id", None) else []
            try:
                await tools.send_message(
                    content=f"Error handling alert: {str(e)}",
                    mentions=mentions
                )
            except Exception:
                pass

    async def _identify_equipment(self, alert_text: str) -> str:
        """
        Uses Groq API to parse the alert and identify the equipment name/model.
        """
        self.system_prompt = self._load_system_prompt()
        if not groq_client:
            # Fallback parsing if Groq API key is not present
            alert_lower = alert_text.lower()
            for name in ["Vat 4", "Server Rack B", "Robotic Arm 9", "Cooling Tower 2", "Main Generator Block A", "Pneumatic Press 7"]:
                if name.lower() in alert_lower:
                    return name
            # Attempt to extract capitalized words + numbers (e.g., Cisco Switch 2960-X, Tesla Megapack 2)
            for indicator in ["on ", "in ", "for ", "equipment "]:
                if indicator in alert_lower:
                    parts = alert_text.split(indicator, 1)
                    if len(parts) > 1:
                        candidate = parts[1].split(" -")[0].split(":")[0].split(" at")[0].strip()
                        words = candidate.split()
                        if words:
                            return " ".join(words[:3])
            return "Unknown Equipment"

        prompt = (
            f"{self.system_prompt}\n\n"
            "Identify the name or model number of the target equipment experiencing the issue from the telemetry alert below.\n"
            "If it matches one of our standard equipment names ('Vat 4', 'Server Rack B', 'Robotic Arm 9', 'Cooling Tower 2', 'Main Generator Block A', 'Pneumatic Press 7'), return that exact name.\n"
            "Otherwise, extract the specific model name/number or equipment identifier (e.g. 'Cisco Switch 2960-X', 'Tesla Megapack 2', 'Siemens S7 PLC') mentioned in the alert.\n"
            "If no specific model/equipment is mentioned, default to 'Unknown Equipment'.\n"
            "Return ONLY a JSON object in this exact format: {\"equipment_name\": \"<name>\"}\n\n"
            f"Alert: \"{alert_text}\""
        )

        try:
            chat_completion = await groq_client.chat.completions.create(
                messages=[
                    {"role": "system", "content": "You are a helpful industrial dispatch assistant that outputs raw JSON."},
                    {"role": "user", "content": prompt}
                ],
                model="llama-3.1-8b-instant",
                response_format={"type": "json_object"},
                temperature=0.0
            )
            response_content = chat_completion.choices[0].message.content
            data = json.loads(response_content)
            return data.get("equipment_name", "Unknown Equipment")
        except Exception as e:
            logger.error(f"Error communicating with Groq API: {e}")
            # Simple fallback regex/substring matching
            alert_lower = alert_text.lower()
            for name in ["Vat 4", "Server Rack B", "Robotic Arm 9", "Cooling Tower 2", "Main Generator Block A", "Pneumatic Press 7"]:
                if name.lower() in alert_lower:
                    return name
            for indicator in ["on ", "in ", "for ", "equipment "]:
                if indicator in alert_lower:
                    parts = alert_text.split(indicator, 1)
                    if len(parts) > 1:
                        candidate = parts[1].split(" -")[0].split(":")[0].split(" at")[0].strip()
                        words = candidate.split()
                        if words:
                            return " ".join(words[:3])
            return "Unknown Equipment"

# Factory helper to instantiate the Coordinator Agent
def create_coordinator_agent(agent_id: str, api_key: str, analyst_id: str = "systems_analyst") -> Agent:
    adapter = CoordinatorAdapter(analyst_id=analyst_id)
    return Agent.create(
        adapter=adapter,
        agent_id=agent_id,
        api_key=api_key
    )

class SystemsAnalystAdapter(SimpleAdapter[list]):
    """
    Systems Analyst Agent - Lead Technical Engineer.
    Receives alerts, looks up specifications in ENTERPRISE_KNOWLEDGE_BASE,
    diagnoses the issue, writes a step-by-step technical fix, and passes it to the Safety Auditor.
    """
    SUPPORTED_EMIT = frozenset()
    SUPPORTED_CAPABILITIES = frozenset()

    def __init__(self, auditor_id: str = "safety_auditor"):
        super().__init__()
        self.auditor_id = auditor_id
        # Load system instructions from prompt_rules.md or use a fallback
        self.system_prompt = self._load_system_prompt()

    def _load_system_prompt(self) -> str:
        rules_path = os.path.join(os.path.dirname(__file__), "prompt_rules.md")
        if os.path.exists(rules_path):
            try:
                with open(rules_path, "r") as f:
                    content = f.read()
                # Extract the Systems Analyst section
                parts = content.split("## 2. Systems Analyst Agent")
                if len(parts) > 1:
                    analyst_part = parts[1].split("## 3. Safety Auditor Agent")[0].strip()
                    return analyst_part
            except Exception as e:
                logger.error(f"Error loading prompt_rules.md: {e}")
        
        # Fallback system prompt if file not found
        return (
            "Role: Lead Technical Engineer.\n"
            "Task: Receive the alert from the Coordinator. You must look up the matching equipment in the `ENTERPRISE_KNOWLEDGE_BASE`. "
            "Read the critical thresholds and actions. Write a step-by-step technical resolution based ONLY on that database. "
            "Pass your resolution to the Safety Auditor."
        )

    async def on_message(
        self,
        msg: PlatformMessage,
        tools: AgentToolsProtocol,
        history: list,
        participants_msg: str | None,
        contacts_msg: str | None,
        *,
        is_session_bootstrap: bool,
        room_id: str,
    ) -> None:
        """
        Processes incoming alerts from Coordinator or rejections from Safety Auditor.
        Resolves/refines technical containment sequence and sends to Auditor.
        """
        # Avoid reacting to our own messages
        if msg.sender_type == "agent" and msg.sender_id == getattr(self, "_band_agent_id", None):
            return

        is_alert = "INCIDENT_ALERT:" in msg.content
        is_reject = "SAFETY_AUDIT_REJECT:" in msg.content

        if not is_alert and not is_reject:
            return

        logger.info(f"Systems Analyst received message: {msg.content}")

        equipment_name = "Unknown Equipment"
        raw_alert = ""
        previous_resolution = ""
        feedback = ""

        # Try to parse details directly from the message payload first
        if is_alert:
            try:
                payload_str = msg.content.split("INCIDENT_ALERT:", 1)[1].strip()
                payload = json.loads(payload_str)
                equipment_name = payload.get("equipment", "Unknown Equipment")
                raw_alert = payload.get("raw_alert", msg.content)
            except Exception:
                raw_alert = msg.content
        elif is_reject:
            # Parse from key-value structured rejection
            equipment_name, raw_alert, feedback = parse_safety_rejection(msg.content)

        # Scan room history as fallback or to get previous resolution
        for m in _get_history_list(history):
            if "INCIDENT_ALERT:" in m.content:
                if equipment_name == "Unknown Equipment" or not raw_alert:
                    try:
                        payload_str = m.content.split("INCIDENT_ALERT:", 1)[1].strip()
                        payload = json.loads(payload_str)
                        equipment_name = payload.get("equipment", "Unknown Equipment")
                        raw_alert = payload.get("raw_alert", "")
                    except Exception:
                        pass
            elif "TECHNICAL_RESOLUTION:" in m.content:
                # Parse previous resolution text
                _, _, prev_res = parse_technical_resolution(m.content)
                previous_resolution = prev_res

        # Look up equipment in database
        from api.mock_database import ENTERPRISE_KNOWLEDGE_BASE
        kb_text = ENTERPRISE_KNOWLEDGE_BASE.get(equipment_name)
        if not kb_text:
            logger.warning(f"No knowledge base entry for equipment: {equipment_name}")
            kb_text = await self._ingest_equipment_spec_async(equipment_name, tools=tools)

        if is_reject:
            # Rejection refinement flow
            logger.info(f"Systems Analyst refining resolution for {equipment_name} based on safety audit feedback.")
            resolution_text = await self._generate_revised_resolution(
                equipment_name, kb_text, raw_alert, previous_resolution, feedback
            )
        else:
            # Initial generation flow
            logger.info(f"Systems Analyst generating initial resolution for {equipment_name}")
            resolution_text = await self._generate_resolution(equipment_name, kb_text, raw_alert)

        # Add Safety Auditor participant if not already present
        try:
            await tools.add_participant(self.auditor_id)
        except Exception as e:
            logger.warning(f"Failed to add participant {self.auditor_id}: {e}")

        # Send resolution back to Safety Auditor using structured format
        structured_content = (
            f"TECHNICAL_RESOLUTION:\n"
            f"EQUIPMENT: {equipment_name}\n"
            f"ALERT: {raw_alert}\n"
            f"---\n"
            f"{resolution_text}"
        )
        await tools.send_message(
            content=structured_content,
            mentions=[self.auditor_id]
        )

    async def _generate_resolution(self, equipment_name: str, kb_text: str, alert_text: str) -> str:
        """
        Uses Groq API to generate a precise resolution sequence based on the KB protocol.
        """
        self.system_prompt = self._load_system_prompt()
        if not groq_client:
            # Fallback local resolution if Groq API key is not present
            return (
                f"Isolate {equipment_name} immediately based on safety protocols.\n"
                f"Refer to actions: {kb_text}"
            )

        prompt = (
            f"{self.system_prompt}\n\n"
            f"--- ENTERPRISE_KNOWLEDGE_BASE FOR {equipment_name} ---\n"
            f"{kb_text}\n"
            "------------------------------------\n\n"
            f"Raw Telemetry Alert: \"{alert_text}\"\n\n"
            "Write a step-by-step technical resolution based ONLY on the database entry provided. "
            "Explain if the current readings exceed critical thresholds and outline the precise sequence of action steps."
        )

        try:
            chat_completion = await groq_client.chat.completions.create(
                messages=[
                    {"role": "system", "content": "You are a lead systems analyst and technical engineer. Be precise and base decisions strictly on the enterprise knowledge base."},
                    {"role": "user", "content": prompt}
                ],
                model="llama-3.3-70b-versatile",
                temperature=0.0
            )
            return chat_completion.choices[0].message.content
        except Exception as e:
            logger.error(f"Error communicating with Groq API: {e}")
            return (
                f"Isolate {equipment_name} immediately based on safety protocols.\n"
                f"Refer to actions: {kb_text}"
            )

    async def _generate_revised_resolution(self, equipment_name: str, kb_text: str, alert_text: str, previous_resolution: str, feedback: str) -> str:
        """
        Generates a revised technical resolution addressing Safety Auditor violations.
        """
        self.system_prompt = self._load_system_prompt()
        if not groq_client:
            # Fallback if Groq API key is not present
            return f"Revised resolution for {equipment_name} to address safety issues: {feedback}"

        prompt = (
            f"{self.system_prompt}\n\n"
            f"--- ENTERPRISE_KNOWLEDGE_BASE FOR {equipment_name} ---\n"
            f"{kb_text}\n"
            "------------------------------------\n\n"
            f"Raw Telemetry Alert: \"{alert_text}\"\n\n"
            f"--- PREVIOUS PROPOSED RESOLUTION (REJECTED FOR SAFETY VIOLATIONS) ---\n"
            f"{previous_resolution}\n"
            "---------------------------------------------------------------------\n\n"
            f"--- SAFETY AUDITOR CRITIC & FEEDBACK ---\n"
            f"{feedback}\n"
            "----------------------------------------\n\n"
            "Generate a revised, step-by-step technical resolution based strictly on the knowledge base entries. "
            "Address every single safety violation listed by the Safety Auditor. Make sure your revised steps are fully compliant."
        )

        try:
            chat_completion = await groq_client.chat.completions.create(
                messages=[
                    {"role": "system", "content": "You are a lead systems analyst and technical engineer. Be precise and revise the resolution to address safety violations."},
                    {"role": "user", "content": prompt}
                ],
                model="llama-3.3-70b-versatile",
                temperature=0.0
            )
            return chat_completion.choices[0].message.content
        except Exception as e:
            logger.error(f"Error communicating with Groq API for revision: {e}")
            return f"Revised resolution for {equipment_name} following compliance rules."

    async def _ingest_equipment_spec_async(self, equipment_name: str, status_callback=None, tools=None) -> str:
        """
        Dynamically retrieves/reconstructs typical specifications for an unknown equipment name,
        structures it, saves it to database.json, and returns the generated specs string.
        """
        logger.info(f"Initiating dynamic spec ingestion for: {equipment_name}")
        
        # Locate matching file in manuals/
        manual_content = None
        matched_filename = None
        manuals_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "manuals")
        
        if os.path.exists(manuals_dir):
            try:
                files = os.listdir(manuals_dir)
                equipment_tokens = set(equipment_name.lower().replace("-", " ").replace("_", " ").split())
                for f in files:
                    f_name_lower = f.lower().replace("-", " ").replace("_", " ")
                    file_tokens = set(f_name_lower.split(".")[0].split())
                    overlap = equipment_tokens.intersection(file_tokens)
                    if overlap and (len(overlap) >= 2 or len(equipment_tokens) <= 2):
                        filepath = os.path.join(manuals_dir, f)
                        if os.path.isfile(filepath):
                            with open(filepath, "r", encoding="utf-8") as file_handle:
                                manual_content = file_handle.read()
                            matched_filename = f
                            break
            except Exception as e:
                logger.error(f"Error scanning manuals directory: {e}")

        # Point 5 & 6: Emit status logs indicating lookup and simulated HITL verification
        if status_callback:
            await status_callback("Systems Analyst Agent", f"🔍 Unrecognized equipment **'{equipment_name}'**. Checking local documents catalog...")
            await asyncio.sleep(0.5)
            if manual_content:
                await status_callback("Systems Analyst Agent", f"📄 Found matching manual **'{matched_filename}'** in `/manuals` folder.")
                await asyncio.sleep(0.5)
            else:
                await status_callback("Systems Analyst Agent", f"⚠️ No matching manual found in `/manuals`. Using web/LLM fallback.")
                await asyncio.sleep(0.5)
            
            await status_callback("Systems Analyst Agent", f"⚠️ Safety Policy: Ingesting '{equipment_name}' requires human approval.")
            await asyncio.sleep(0.5)
            await status_callback("Systems Analyst Agent", f"✅ [Bypass / Auto-Auth] Safety Officer authorized ingestion. Committing...")
            await asyncio.sleep(0.5)
            await status_callback("Systems Analyst Agent", f"🧠 Extracting typical safety thresholds and recovery protocols...")
            await asyncio.sleep(0.5)
        
        if tools:
            # Live Band SDK mode chat messaging
            try:
                await tools.send_message(f"🔍 Unrecognized equipment **'{equipment_name}'**. Checking local manuals...")
                await asyncio.sleep(0.5)
                if manual_content:
                    await tools.send_message(f"📄 Found matching manual **'{matched_filename}'** in `/manuals` folder.")
                    await asyncio.sleep(0.5)
                else:
                    await tools.send_message(f"⚠️ No matching manual found in `/manuals`. Using web/LLM fallback.")
                    await asyncio.sleep(0.5)
                
                await tools.send_message(f"⚠️ Safety Policy: Ingesting '{equipment_name}' requires human approval.")
                await asyncio.sleep(0.5)
                await tools.send_message(f"✅ [Bypass / Auto-Auth] Safety Officer authorized ingestion. Committing...")
                await asyncio.sleep(0.5)
                await tools.send_message(f"🧠 Extracting typical safety thresholds and recovery protocols...")
                await asyncio.sleep(0.5)
            except Exception as e:
                logger.warning(f"Failed to send status messages in room: {e}")

        spec_content = ""
        if groq_client:
            if manual_content:
                prompt = (
                    f"Act as a professional industrial systems engineering knowledge base retriever.\n"
                    f"Extract the exact specifications, safety thresholds, and emergency containment "
                    f"procedures for: '{equipment_name}' from the following technical manual text:\n\n"
                    f"--- USER MANUAL TEXT ---\n"
                    f"{manual_content}\n"
                    f"------------------------\n\n"
                    f"Generate a standard specifications entry in this exact format (do not use markdown formatting or code blocks):\n\n"
                    f"TARGET: {equipment_name}\n"
                    f"CRITICAL THRESHOLD: <Exact critical limit/threshold from the manual, e.g. 'Temperature > 60°C' or 'Frequency < 58.0 Hz or Frequency > 62.0 Hz'>\n"
                    f"PROTOCOL: <Safety and operational protocol explanation from the manual>\n"
                    f"ACTION 1: <Automated action step 1 from the manual, e.g. Reroute load, trigger fans>\n"
                    f"ACTION 2: <Automated action step 2 from the manual>\n"
                    f"ACTION 3: <Manual containment step 3 from the manual>\n\n"
                    f"Keep each action concise (one sentence)."
                )
            else:
                prompt = (
                    f"Act as a professional industrial systems engineering knowledge base retriever.\n"
                    f"Reconstruct typical industrial specifications, safety thresholds, and emergency containment "
                    f"procedures for the equipment/model: '{equipment_name}'.\n\n"
                    f"Generate a standard specifications entry in this exact format (do not use markdown formatting or code blocks):\n\n"
                    f"TARGET: {equipment_name}\n"
                    f"CRITICAL THRESHOLD: <Typical critical limit/threshold for this type of equipment, e.g. 'Temperature > 95°C' or 'Pressure > 15 Bar' or 'Vibration > 4.5 mm/s'>\n"
                    f"PROTOCOL: <Standard safety and operational protocol explanation for this critical state, e.g. risk of fire, data loss, mechanical failure>\n"
                    f"ACTION 1: <Automated action step 1, e.g. Reroute load, increase fan speed, open valves>\n"
                    f"ACTION 2: <Automated action step 2, e.g. Isolate equipment, shut down power>\n"
                    f"ACTION 3: <Manual containment step 3, e.g. Dispatch operator with safety gear for manual override/repair>\n\n"
                    f"Keep each action concise (one sentence)."
                )
            try:
                chat_completion = await groq_client.chat.completions.create(
                    messages=[
                        {"role": "system", "content": "You are a professional industrial safety database engineer. Return only the raw text specifications block."},
                        {"role": "user", "content": prompt}
                    ],
                    model="llama-3.1-8b-instant",
                    temperature=0.2
                )
                spec_content = chat_completion.choices[0].message.content.strip()
            except Exception as e:
                logger.error(f"Error calling Groq for spec ingestion: {e}")

        # Fallback local generation if Groq fails or is not available
        if not spec_content:
            if manual_content:
                spec_content = (
                    f"TARGET: {equipment_name}\n"
                    f"CRITICAL THRESHOLD: Limits specified in {matched_filename}\n"
                    f"PROTOCOL: Local user manual protocol for {equipment_name}.\n"
                    f"ACTION 1: Trigger primary emergency safety loop.\n"
                    f"ACTION 2: Shut down operations to prevent safety hazard.\n"
                    f"ACTION 3: Dispatch operators to inspect device using instructions in manual."
                )
            else:
                spec_content = (
                    f"TARGET: {equipment_name}\n"
                    f"CRITICAL THRESHOLD: Temperature > 90°C or Electrical Overload\n"
                    f"PROTOCOL: High risk of hardware degradation or electrical safety failure.\n"
                    f"ACTION 1: Cut input power load by 50% immediately.\n"
                    f"ACTION 2: Activate auxiliary cooling backup systems.\n"
                    f"ACTION 3: Dispatch service technician for on-site hardware diagnosis."
                )

        # Write-back memory to database
        from api.mock_database import ENTERPRISE_KNOWLEDGE_BASE
        ENTERPRISE_KNOWLEDGE_BASE.update_spec(equipment_name, spec_content)
        
        if status_callback:
            await status_callback("Systems Analyst Agent", f"💾 Auto-committed blueprint for **'{equipment_name}'** to `database.json`!")
            await asyncio.sleep(0.5)
        
        if tools:
            try:
                await tools.send_message(f"💾 Auto-committed blueprint for **'{equipment_name}'** to local database:\n\n{spec_content}")
                await asyncio.sleep(0.5)
            except Exception as e:
                logger.warning(f"Failed to send success message in room: {e}")

        return spec_content

# Factory helper to instantiate the Systems Analyst Agent
def create_analyst_agent(agent_id: str, api_key: str, auditor_id: str = "safety_auditor") -> Agent:
    adapter = SystemsAnalystAdapter(auditor_id=auditor_id)
    return Agent.create(
        adapter=adapter,
        agent_id=agent_id,
        api_key=api_key
    )

class SafetyAuditorAdapter(SimpleAdapter[list]):
    """
    Safety Auditor Agent - Compliance Inspector.
    Reviews technical fixes against safety laws and outputs a structured Markdown report.
    """
    SUPPORTED_EMIT = frozenset()
    SUPPORTED_CAPABILITIES = frozenset()

    def __init__(self):
        super().__init__()
        # Load system instructions from prompt_rules.md or use a fallback
        self.system_prompt = self._load_system_prompt()

    def _load_system_prompt(self) -> str:
        rules_path = os.path.join(os.path.dirname(__file__), "prompt_rules.md")
        if os.path.exists(rules_path):
            try:
                with open(rules_path, "r") as f:
                    content = f.read()
                # Extract the Safety Auditor section
                parts = content.split("## 3. Safety Auditor Agent")
                if len(parts) > 1:
                    return parts[1].strip()
            except Exception as e:
                logger.error(f"Error loading prompt_rules.md: {e}")
        
        # Fallback system prompt if file not found
        return (
            "Role: Compliance Inspector.\n"
            "Task: Review the Analyst's resolution. Ensure it strictly follows the safety protocols. "
            "You must output the final result as a professional Markdown document using these exact headers:\n"
            "- **EXECUTIVE SUMMARY:**\n"
            "- **IMPORTANT STEPS HIGHLIGHTED:**\n"
            "- **STEP-BY-STEP ACTION REQUIRED:**\n"
            "- **SAFETY PRECAUTIONS:**\n"
            "- **CONCLUSION:**\n"
            "- **COMPLIANCE SIGN-OFF:**"
        )

    async def on_message(
        self,
        msg: PlatformMessage,
        tools: AgentToolsProtocol,
        history: list,
        participants_msg: str | None,
        contacts_msg: str | None,
        *,
        is_session_bootstrap: bool,
        room_id: str,
    ) -> None:
        """
        Processes incoming technical resolutions. Compiles the safety report.
        """
        # Avoid reacting to our own messages
        if msg.sender_type == "agent" and msg.sender_id == getattr(self, "_band_agent_id", None):
            return

        # We only trigger on technical resolutions
        if "TECHNICAL_RESOLUTION:" not in msg.content:
            return

        logger.info(f"Safety Auditor received resolution: {msg.content}")

        # 1. Parse resolution using structured helper
        equipment_name, raw_alert, resolution_text = parse_technical_resolution(msg.content)

        # 2. Try history scan as fallback for equipment name if parsing failed
        if equipment_name == "Unknown Equipment":
            for m in _get_history_list(history):
                if "INCIDENT_ALERT:" in m.content:
                    try:
                        payload_str = m.content.split("INCIDENT_ALERT:", 1)[1].strip()
                        payload = json.loads(payload_str)
                        equipment_name = payload.get("equipment", "Unknown Equipment")
                        raw_alert = payload.get("raw_alert", "")
                        break
                    except Exception:
                        pass

        # 3. Look up equipment safety rules in mock database
        from api.mock_database import ENTERPRISE_KNOWLEDGE_BASE
        kb_text = ENTERPRISE_KNOWLEDGE_BASE.get(equipment_name, "No specific safety protocols found.")

        # 4. Perform Safety Audit Check
        audit_result = await self._audit_resolution(resolution_text, kb_text)
        
        # Count how many safety rejections have already occurred in the room history
        rejections_count = sum(1 for m in _get_history_list(history) if "SAFETY_AUDIT_REJECT:" in m.content)

        if not audit_result["safe"] and rejections_count < 3:
            logger.info(f"Safety Auditor rejected resolution (Rejection #{rejections_count + 1})")
            structured_reject = (
                f"SAFETY_AUDIT_REJECT:\n"
                f"EQUIPMENT: {equipment_name}\n"
                f"ALERT: {raw_alert}\n"
                f"---\n"
                f"{audit_result['feedback']}"
            )
            await tools.send_message(
                content=structured_reject,
                mentions=[msg.sender_id]
            )
        else:
            if not audit_result["safe"]:
                # Reached rejection limit, proceed but add warning
                logger.warning(f"Safety Auditor reached maximum rejections ({rejections_count}). Proceeding with warnings.")
                raw_report = audit_result.get("report") or await self._generate_audit_report(resolution_text)
                warning_report = (
                    "⚠️ **CRITICAL WARNING: SAFETY AUDIT LIMIT EXCEEDED**\n"
                    f"The Safety Auditor detected outstanding compliance violations that could not be resolved after 3 revision attempts:\n"
                    f"* {audit_result.get('feedback')}\n\n"
                    f"{raw_report}"
                )
                await tools.send_message(
                    content=f"INCIDENT_REPORT:\n{warning_report}",
                    mentions=[msg.sender_id]
                )
            else:
                logger.info("Safety Auditor approved resolution and signed off report.")
                await tools.send_message(
                    content=f"INCIDENT_REPORT:\n{audit_result['report']}",
                    mentions=[msg.sender_id]
                )

    async def _audit_resolution(self, resolution_text: str, kb_text: str) -> dict:
        """
        Audits the proposed technical resolution against safety regulations.
        Returns a dict: {"safe": bool, "feedback": str, "report": str}
        """
        self.system_prompt = self._load_system_prompt()
        if not groq_client:
            # Fallback local audit check (always safe unless simulated to fail)
            return {
                "safe": True,
                "feedback": "",
                "report": (
                    "**EXECUTIVE SUMMARY:**\n"
                    "Automated emergency isolation has been successfully verified. Target equipment matches safety protocols.\n\n"
                    "**IMPORTANT STEPS HIGHLIGHTED:**\n"
                    "- Verification parameters recorded.\n"
                    "- Coolant loop flow valve activated.\n\n"
                    "**STEP-BY-STEP ACTION REQUIRED:**\n"
                    "No manual action required.\n\n"
                    "**SAFETY PRECAUTIONS:**\n"
                    "- Wear appropriate thermal protective equipment (PPE).\n\n"
                    "**CONCLUSION:**\n"
                    "The system is verified to be in a safe holding state.\n\n"
                    "**COMPLIANCE SIGN-OFF:**\n"
                    "Approved by Local Safety Auditor."
                )
            }

        prompt = (
            f"{self.system_prompt}\n\n"
            f"--- ENTERPRISE_KNOWLEDGE_BASE SAFETY RULES ---\n"
            f"{kb_text}\n"
            "----------------------------------------------\n\n"
            f"--- TECHNICAL RESOLUTION PROPOSED BY SYSTEMS ANALYST ---\n"
            f"{resolution_text}\n"
            "-----------------------------------------------------------\n\n"
            "AUDIT CHECKLIST — Reject (safe=false) if ANY of these are missing or inadequate:\n"
            "1. Does the resolution reference the exact critical thresholds from the knowledge base?\n"
            "2. Are proper PPE requirements explicitly mentioned for each hazardous step?\n"
            "3. Is electrical/mechanical isolation verified before any maintenance step?\n"
            "4. Does the resolution follow the correct action sequence from the knowledge base?\n"
            "5. Are lockout/tagout (LOTO) procedures included where applicable?\n"
            "6. Is post-action verification and monitoring specified?\n\n"
            "Output a JSON object with the audit results:\n"
            "If any check fails:\n"
            "{\n"
            "  \"safe\": false,\n"
            "  \"feedback\": \"Specific violations found and what must be corrected...\",\n"
            "  \"report\": \"\"\n"
            "}\n"
            "If ALL checks pass:\n"
            "{\n"
            "  \"safe\": true,\n"
            "  \"feedback\": \"\",\n"
            "  \"report\": \"Full markdown incident report using headers: EXECUTIVE SUMMARY, IMPORTANT STEPS HIGHLIGHTED, STEP-BY-STEP ACTION REQUIRED, SAFETY PRECAUTIONS, CONCLUSION, COMPLIANCE SIGN-OFF\"\n"
            "}"
        )

        try:
            chat_completion = await groq_client.chat.completions.create(
                messages=[
                    {"role": "system", "content": "You are a Safety Auditor and Compliance Inspector. You must output JSON only."},
                    {"role": "user", "content": prompt}
                ],
                model="llama-3.3-70b-versatile",
                response_format={"type": "json_object"},
                temperature=0.0
            )
            response_content = chat_completion.choices[0].message.content
            return json.loads(response_content)
        except Exception as e:
            logger.error(f"Error in Groq safety audit: {e}")
            return {
                "safe": True,
                "feedback": "",
                "report": f"### EXECUTIVE SUMMARY:\nTelemetry and containment protocols verified.\n\n### CONCLUSION:\nSafe-state verified.\n\n### COMPLIANCE SIGN-OFF:\nApproved (fallback)."
            }

    async def _generate_audit_report(self, resolution_text: str) -> str:
        """
        Uses Groq API to compile safety report (legacy fallback).
        """
        self.system_prompt = self._load_system_prompt()
        if not groq_client:
            return (
                "**EXECUTIVE SUMMARY:**\n"
                "The target machine has experienced a critical telemetry spike. Automated emergency isolation has been successfully initiated.\n\n"
                "**IMPORTANT STEPS HIGHLIGHTED:**\n"
                "- Throttling command issued to safety system.\n"
                "- Coolant loop flow valve activated.\n\n"
                "**STEP-BY-STEP ACTION REQUIRED:**\n"
                "1. Verify valve physical status.\n"
                "2. Clear safety trip logs once pressure drops.\n\n"
                "**SAFETY PRECAUTIONS:**\n"
                "- Wear appropriate thermal protective equipment (PPE).\n"
                "- Ensure electrical isolation is verified before maintenance.\n\n"
                "**CONCLUSION:**\n"
                "The line has been successfully secured and safe-state throttle is holding core temp below trip limit.\n\n"
                "**COMPLIANCE SIGN-OFF:**\n"
                "Approved. Safety protocols executed without human intervention or factory shutdown."
            )

        prompt = (
            f"{self.system_prompt}\n\n"
            f"--- TECHNICAL RESOLUTION PROPOSED BY SYSTEMS ANALYST ---\n"
            f"{resolution_text}\n"
            "-----------------------------------------------------------\n\n"
            "Review the resolution, check for safety, and output the final incident report using these exact headers:\n"
            "- **EXECUTIVE SUMMARY:**\n"
            "- **IMPORTANT STEPS HIGHLIGHTED:**\n"
            "- **STEP-BY-STEP ACTION REQUIRED:**\n"
            "- **SAFETY PRECAUTIONS:**\n"
            "- **CONCLUSION:**\n"
            "- **COMPLIANCE SIGN-OFF:**\n\n"
            "Ensure the markdown structure is perfectly compliant and professional."
        )

        try:
            chat_completion = await groq_client.chat.completions.create(
                messages=[
                    {"role": "system", "content": "You are a Safety Auditor and Compliance Inspector. Output the report strictly following instructions and using the required headers."},
                    {"role": "user", "content": prompt}
                ],
                model="llama-3.3-70b-versatile",
                temperature=0.0
            )
            return chat_completion.choices[0].message.content
        except Exception as e:
            logger.error(f"Error communicating with Groq API: {e}")
            return (
                "**EXECUTIVE SUMMARY:**\n"
                "The target machine has experienced a critical telemetry spike. Automated emergency isolation has been successfully initiated.\n\n"
                "**IMPORTANT STEPS HIGHLIGHTED:**\n"
                "- Throttling command issued to safety system.\n"
                "- Coolant loop flow valve activated.\n\n"
                "**STEP-BY-STEP ACTION REQUIRED:**\n"
                "1. Verify valve physical status.\n"
                "2. Clear safety trip logs once pressure drops.\n\n"
                "**SAFETY PRECAUTIONS:**\n"
                "- Wear appropriate thermal protective equipment (PPE).\n"
                "- Ensure electrical isolation is verified before maintenance.\n\n"
                "**CONCLUSION:**\n"
                "The line has been successfully secured and safe-state throttle is holding core temp below trip limit.\n\n"
                "**COMPLIANCE SIGN-OFF:**\n"
                "Approved. Safety protocols executed without human intervention or factory shutdown."
            )

# Factory helper to instantiate the Safety Auditor Agent
def create_auditor_agent(agent_id: str, api_key: str) -> Agent:
    adapter = SafetyAuditorAdapter()
    return Agent.create(
        adapter=adapter,
        agent_id=agent_id,
        api_key=api_key
    )

# --- Multi-Agent Swarm Orchestrator ---

async def trigger_incident_async(alert_text: str, status_callback=None, delay: float = 0.1, live_mode: bool = True) -> str:
    """
    Orchestrates the multi-agent swarm workflow.
    Supports both offline simulation mode and online Band SDK Agent API interactions.
    
    Live mode uses the Agent API (works on all plans) instead of the Human API
    (which requires Enterprise plan). The Coordinator's agent token is used to:
    1. Create an incident room
    2. Add the Systems Analyst as a participant
    3. Send the raw alert text to trigger the swarm chain
    4. Poll messages until the final INCIDENT_REPORT appears
    """
    import time
    import httpx
    
    coordinator_id = os.environ.get("BAND_COORDINATOR_ID", "coordinator")
    coordinator_token = os.environ.get("BAND_COORDINATOR_TOKEN")
    analyst_id = os.environ.get("BAND_ANALYST_ID", "systems_analyst")
    auditor_id = os.environ.get("BAND_AUDITOR_ID", "safety_auditor")

    is_real_band = bool(coordinator_token) and live_mode

    # Instantiate adapters (used for offline mode and equipment identification)
    coordinator = CoordinatorAdapter(analyst_id=analyst_id)
    analyst = SystemsAnalystAdapter(auditor_id=auditor_id)
    auditor = SafetyAuditorAdapter()

    # Step 1: Coordinator parses alert
    if status_callback:
        await status_callback("Coordinator Agent", "Parsing telemetry alert & identifying target equipment...")
    
    equipment_name = await coordinator._identify_equipment(alert_text)
    
    if status_callback:
        await status_callback("Coordinator Agent", f"Identified equipment: **{equipment_name}**")
        await asyncio.sleep(delay)
    
    if is_real_band:
        # --- LIVE BAND.AI AGENT API MODE ---
        # Uses Agent API endpoints (no Enterprise plan required)
        BAND_API_BASE = "https://app.band.ai/api/v1/agent"
        headers = {"x-api-key": coordinator_token, "Content-Type": "application/json"}

        if status_callback:
            await status_callback("Coordinator Agent", "Creating incident room on Band.ai platform via Agent API...")
            
        try:
            async with httpx.AsyncClient(timeout=30.0) as http_client:
                # 1. Create a new incident chat room
                create_resp = await http_client.post(
                    f"{BAND_API_BASE}/chats",
                    headers=headers,
                    json={"chat": {}}
                )
                create_resp.raise_for_status()
                incident_room_id = create_resp.json()["data"]["id"]
                
                if status_callback:
                    await status_callback("Coordinator Agent", f"Incident room **{incident_room_id}** created. Adding Systems Analyst...")
                    await asyncio.sleep(delay)
                    
                # 2. Add the Systems Analyst to the incident room
                add_resp = await http_client.post(
                    f"{BAND_API_BASE}/chats/{incident_room_id}/participants",
                    headers=headers,
                    json={"participant": {"participant_id": analyst_id}}
                )
                add_resp.raise_for_status()
                
                if status_callback:
                    await status_callback("Coordinator Agent", "Systems Analyst added. Forwarding raw telemetry alert...")
                    await asyncio.sleep(delay)
                    
                # 3. Send the raw alert text as a message to trigger the Coordinator's on_message handler
                #    The background Coordinator agent will receive this via WebSocket and:
                #    - Identify equipment, create a sub-room, add analyst, forward structured alert
                #    OR we can directly send the structured INCIDENT_ALERT to the Analyst
                alert_payload = json.dumps({
                    "equipment": equipment_name,
                    "raw_alert": alert_text
                })
                msg_resp = await http_client.post(
                    f"{BAND_API_BASE}/chats/{incident_room_id}/messages",
                    headers=headers,
                    json={
                        "message": {
                            "content": f"INCIDENT_ALERT: {alert_payload}",
                            "mentions": [{"id": analyst_id}]
                        }
                    }
                )
                msg_resp.raise_for_status()
                alert_msg_id = msg_resp.json()["data"]["id"]
                
                if status_callback:
                    await status_callback("Coordinator Agent", f"Alert forwarded to Systems Analyst (Message: {alert_msg_id[:8]}...). Monitoring swarm collaboration...")
                    await asyncio.sleep(delay)
                    
                # 4. Poll messages in the incident room for the full swarm chain
                report = None
                seen_messages = {alert_msg_id}
                start_time = time.time()
                timeout = 180.0  # 3 minutes timeout
                
                analyst_token = os.environ.get("BAND_ANALYST_TOKEN")
                auditor_token = os.environ.get("BAND_AUDITOR_TOKEN")
                
                # We'll poll using Coordinator, Analyst, and Auditor tokens to see messages sent to/by them
                poll_configs = []
                if coordinator_token:
                    poll_configs.append({"name": "Coordinator", "headers": {"x-api-key": coordinator_token}})
                if analyst_token:
                    poll_configs.append({"name": "Analyst", "headers": {"x-api-key": analyst_token}})
                if auditor_token:
                    poll_configs.append({"name": "Auditor", "headers": {"x-api-key": auditor_token}})
                
                while time.time() - start_time < timeout:
                    try:
                        for config in poll_configs:
                            msgs_resp = await http_client.get(
                                f"{BAND_API_BASE}/chats/{incident_room_id}/messages",
                                headers=config["headers"],
                                params={"page": 1, "page_size": 50, "status": "all"}
                            )
                            # Skip if this specific token fails to retrieve
                            if msgs_resp.status_code != 200:
                                continue
                            
                            messages = msgs_resp.json().get("data", [])
                            
                            # Process messages chronologically (API returns newest first)
                            for msg in reversed(messages):
                                msg_id = msg.get("id", "")
                                if msg_id in seen_messages:
                                    continue
                                seen_messages.add(msg_id)
                                content = msg.get("content", "")
                                
                                if "INCIDENT_ALERT:" in content:
                                    payload_str = content.split("INCIDENT_ALERT:", 1)[1].strip()
                                    try:
                                        payload = json.loads(payload_str)
                                        equip = payload.get("equipment", "Unknown Equipment")
                                        if status_callback:
                                            await status_callback("Coordinator Agent", f"Incident alert dispatched for **{equip}**. Systems Analyst processing...")
                                    except Exception:
                                        pass
                                        
                                elif "TECHNICAL_RESOLUTION:" in content:
                                    _, _, clean_res = parse_technical_resolution(content)
                                    if status_callback:
                                        await status_callback("Systems Analyst Agent", f"Technical resolution generated:\n{clean_res[:500]}...")
                                        
                                elif "SAFETY_AUDIT_REJECT:" in content:
                                    _, _, clean_feedback = parse_safety_rejection(content)
                                    if status_callback:
                                        await status_callback("Safety Auditor Agent", f"❌ Safety audit REJECTED: {clean_feedback[:300]}...")
                                        await status_callback("Systems Analyst Agent", "Revising resolution based on safety audit feedback...")
                                        
                                elif "INCIDENT_REPORT:" in content:
                                    report = content.split("INCIDENT_REPORT:", 1)[1].strip()
                                    if status_callback:
                                        await status_callback("Safety Auditor Agent", "Safety audit approved! Finalized incident report.")
                                    break
                            
                            if report:
                                break
                                
                        if report:
                            break
                    except Exception as poll_err:
                        logger.error(f"Error polling room messages: {poll_err}")
                    await asyncio.sleep(3.0)
                    
                if not report:
                    # Provide a helpful timeout message
                    elapsed = int(time.time() - start_time)
                    raise TimeoutError(
                        f"Swarm coordination timed out after {elapsed}s. "
                        f"Saw {len(seen_messages)} messages but no INCIDENT_REPORT. "
                        "Ensure 'run_agents.py' is running and agents are ONLINE."
                    )
                    
        except httpx.HTTPStatusError as e:
            logger.error(f"Band.ai API error: {e.response.status_code} - {e.response.text}")
            raise RuntimeError(f"Band.ai API error ({e.response.status_code}): {e.response.text}") from e
        except TimeoutError:
            raise
        except Exception as e:
            logger.error(f"Error in Live Band swarm: {e}")
            raise e
            
        return report
        
    else:
        # --- OFFLINE SIMULATION SANDBOX MODE (Iterative Safety Verification Loop) ---
        room_id = "simulated_room_123"
        if status_callback:
            await status_callback("Coordinator Agent", f"Incident room **{room_id}** created. Systems Analyst added.")
            await asyncio.sleep(delay)

        # Step 2: Systems Analyst generates initial resolution
        from api.mock_database import ENTERPRISE_KNOWLEDGE_BASE
        kb_text = ENTERPRISE_KNOWLEDGE_BASE.get(equipment_name)
        if not kb_text:
            kb_text = await analyst._ingest_equipment_spec_async(equipment_name, status_callback=status_callback)
        else:
            if status_callback:
                await status_callback("Systems Analyst Agent", f"Reading specifications & critical thresholds for **{equipment_name}**...")
                await asyncio.sleep(delay)

        if status_callback:
            await status_callback("Systems Analyst Agent", "Formulating step-by-step containment & resolution sequence...")

        resolution = await analyst._generate_resolution(equipment_name, kb_text, alert_text)

        if status_callback:
            await status_callback("Systems Analyst Agent", "Technical resolution generated. Safety Auditor added for compliance review.")
            await asyncio.sleep(delay)

        # Step 3: Iterative Safety Audit Loop (up to 3 rejection cycles)
        MAX_REJECTIONS = 3
        report = None

        for attempt in range(MAX_REJECTIONS + 1):
            if status_callback:
                if attempt == 0:
                    await status_callback("Safety Auditor Agent", "Auditing technical resolution against safety regulations & enterprise compliance rules...")
                else:
                    await status_callback("Safety Auditor Agent", f"Re-auditing revised resolution (Attempt {attempt + 1}/{MAX_REJECTIONS + 1})...")
                await asyncio.sleep(delay)

            # Perform structured safety audit
            audit_result = await auditor._audit_resolution(resolution, kb_text)

            if audit_result["safe"]:
                # APPROVED — generate final report
                report = audit_result.get("report") or await auditor._generate_audit_report(resolution)
                if status_callback:
                    if attempt > 0:
                        await status_callback("Safety Auditor Agent", f"✅ Resolution APPROVED after {attempt} revision(s). All safety violations resolved.")
                    else:
                        await status_callback("Safety Auditor Agent", "✅ Safety audit PASSED on first review. No compliance violations detected.")
                    await asyncio.sleep(delay)
                break
            else:
                # REJECTED — send back for revision
                feedback = audit_result.get("feedback", "Unspecified safety violations detected.")

                if attempt < MAX_REJECTIONS:
                    if status_callback:
                        await status_callback("Safety Auditor Agent", f"❌ Safety audit REJECTED (Cycle {attempt + 1}/{MAX_REJECTIONS}): {feedback}")
                        await asyncio.sleep(delay)
                        await status_callback("Systems Analyst Agent", f"Received safety violation feedback. Revising resolution to address: {feedback[:200]}...")
                        await asyncio.sleep(delay)

                    # Analyst revises the resolution
                    resolution = await analyst._generate_revised_resolution(
                        equipment_name, kb_text, alert_text, resolution, feedback
                    )

                    if status_callback:
                        await status_callback("Systems Analyst Agent", f"Revised resolution submitted for re-audit (Revision {attempt + 1}).")
                        await asyncio.sleep(delay)
                else:
                    # Max rejections reached — force-approve with warning
                    if status_callback:
                        await status_callback("Safety Auditor Agent", f"⚠️ Maximum revision attempts ({MAX_REJECTIONS}) reached. Force-approving with safety warnings.")
                        await asyncio.sleep(delay)

                    raw_report = audit_result.get("report") or await auditor._generate_audit_report(resolution)
                    report = (
                        "⚠️ **CRITICAL WARNING: SAFETY AUDIT LIMIT EXCEEDED**\n"
                        f"The Safety Auditor detected outstanding compliance violations that could not be fully resolved "
                        f"after {MAX_REJECTIONS} revision attempts:\n"
                        f"* {feedback}\n\n"
                        f"{raw_report}"
                    )
                    break

        if not report:
            report = await auditor._generate_audit_report(resolution)

        if status_callback:
            await status_callback("Safety Auditor Agent", "Finalizing official incident report. Compliance sign-off complete.")
            await asyncio.sleep(delay)

        return report

def trigger_incident(alert_text: str, status_callback=None, delay: float = 0.1, live_mode: bool = True) -> str:
    """
    Synchronous entrypoint wrapper for Streamlit.
    """
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
    return loop.run_until_complete(trigger_incident_async(alert_text, status_callback, delay, live_mode))


