import os
import json
import uuid
import logging
from datetime import datetime
import aiosqlite

DB_PATH = os.path.join(os.path.dirname(__file__), "safeguard.db")
HISTORY_JSON_PATH = os.path.join(os.path.dirname(__file__), "history.json")
DATABASE_JSON_PATH = os.path.join(os.path.dirname(__file__), "database.json")

logger = logging.getLogger("safeguard_db")

async def init_db():
    """Initializes the SQLite database and performs migrations if tables are empty."""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS history (
                id TEXT PRIMARY KEY,
                timestamp TEXT,
                alert_text TEXT,
                equipment TEXT,
                status TEXT,
                latency REAL,
                logs TEXT,
                report TEXT
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS blueprints (
                name TEXT PRIMARY KEY,
                spec TEXT
            )
        """)
        await db.commit()

    # Run migrations
    await migrate_history()
    await migrate_blueprints()

async def migrate_history():
    """Migrates history records from history.json to SQLite if the history table is empty."""
    if not os.path.exists(HISTORY_JSON_PATH):
        return

    try:
        async with aiosqlite.connect(DB_PATH) as db:
            async with db.execute("SELECT COUNT(*) FROM history") as cursor:
                row = await cursor.fetchone()
                if row and row[0] > 0:
                    return # Already migrated or has data

            # Read history.json
            with open(HISTORY_JSON_PATH, "r", encoding="utf-8") as f:
                history_data = json.load(f)

            if not history_data:
                return

            logger.info(f"Migrating {len(history_data)} history records to SQLite...")
            for record in history_data:
                logs_str = json.dumps(record.get("logs", []))
                await db.execute(
                    "INSERT OR IGNORE INTO history (id, timestamp, alert_text, equipment, status, latency, logs, report) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    (
                        record.get("id"),
                        record.get("timestamp"),
                        record.get("alert_text"),
                        record.get("equipment"),
                        record.get("status"),
                        record.get("latency"),
                        logs_str,
                        record.get("report")
                    )
                )
            await db.commit()
            logger.info("History migration complete.")
    except Exception as e:
        logger.error(f"Failed to migrate history from JSON: {e}")

DEFAULT_BLUEPRINTS = {
    "Server Rack B": "TARGET: Server Rack B (Financial Database)\nCRITICAL THRESHOLD: 85°C\nPROTOCOL: If ambient rack temperature exceeds 80°C, risk of data\ncorruption and hardware melting is imminent.\nACTION 1: Reroute active network traffic to Backup Rack C.\nACTION 2: Throttle Rack B CPU loads to 30%.\nACTION 3: Spin up emergency HVAC unit in Sector 4.",
    "Robotic Arm 9": "TARGET: Conveyor Robotic Arm 9\nCRITICAL FAULT: Motor Stalling / High Torque Resistance\nPROTOCOL: If arm stalls for more than 5 seconds, gear stripping or human\nobstruction is likely.\nACTION 1: Cut main power to Arm 9 immediately (E-Stop).\nACTION 2: Lock conveyor belt to prevent pile-up.\nACTION 3: Dispatch human maintenance crew with lockout/tagout gear for\nphysical inspection.",
    "Cooling Tower 2": "TARGET: Main Water Cooling Tower 2\nCRITICAL THRESHOLD: Flow rate < 10 L/s or Return Water Temp > 45°C\nPROTOCOL: If flow rate drops or temperature spikes, steam locks and boiler\nrupture are imminent.\nACTION 1: Open auxiliary loop bypass flow valves to 100%.\nACTION 2: Throttle steam turbine feed pressure to 40%.\nACTION 3: Inject chemical descaler into active cooling chambers.",
    "Main Generator Block A": "TARGET: Power Supply Main Generator Block A\nCRITICAL THRESHOLD: Frequency < 59.5 Hz or Frequency > 60.5 Hz\nPROTOCOL: Grid frequency instability risks damaging high-voltage factory machinery\nand inducing localized blackouts.\nACTION 1: Isolate Block A from the plant's active grid lines.\nACTION 2: Synchronize and start Backup Generator B.\nACTION 3: Shed non-essential factory zone loads (warehouse lights, HVAC).",
    "Pneumatic Press 7": "TARGET: Heavy Press Sector 3 (Pneumatic Press 7)\nCRITICAL FAULT: System pressure < 4 Bar or Light Curtain obstruction\nPROTOCOL: Insufficient pressure risks material deformation; light curtain breach\nindicates a severe operator crush hazard.\nACTION 1: Trigger physical locks on the pressing piston cylinder.\nACTION 2: Shut down raw component feed conveyor.\nACTION 3: Broadcast alarm signal and sirens in Sector 3.",
    "Centrifugal Pump P-101": "TARGET: Centrifugal Feed Pump P-101\nCRITICAL THRESHOLD: Vibration > 6.5 mm/s or Seal Pressure < 1.5 Bar\nPROTOCOL: High vibration indicates bearing failure or cavitation; low seal pressure risks toxic fluid leak.\nACTION 1: Throttle suction valve V-101 to 20% to prevent cavitation.\nACTION 2: Shut down main motor drive of P-101 and apply lockout/tagout (LOTO).\nACTION 3: Route fluid flow to standby pump P-102.",
    "Conveyor Belt 12": "TARGET: Sector 4 Main Conveyor Belt 12\nCRITICAL FAULT: Belt slippage > 15% or motor current > 45A\nPROTOCOL: Belt slippage or overcurrent indicates motor binding, load jams, or mechanical failure.\nACTION 1: Stop main conveyor drive immediately (E-Stop).\nACTION 2: Alert sorting arm operators to divert incoming package flows.\nACTION 3: Dispatch line maintenance crew to inspect roller bearings.",
    "Chemical Reactor R-202": "TARGET: High-Pressure Chemical Reactor Vessel R-202\nCRITICAL THRESHOLD: Vessel Pressure > 22 Bar\nPROTOCOL: High pressure inside the reactor risks explosive structural failure.\nACTION 1: Open emergency gas relief vent valve RV-202 to release pressure.\nACTION 2: Inject nitrogen catalyst inhibitor to halt exothermic reaction.\nACTION 3: Initiate chemical transfer to dump tank T-301.",
    "Hydraulic Lift HL-3": "TARGET: Heavy Material Hydraulic Lift HL-3\nCRITICAL FAULT: Fluid temperature > 80°C or Pressure drop > 12 Bar\nPROTOCOL: Hydraulic pressure loss indicates hose puncture or valve failure, posing a crush hazard.\nACTION 1: Engage safety lock pins to secure the lift platform in place.\nACTION 2: Shutdown hydraulic power pack motor and apply lockout/tagout (LOTO).\nACTION 3: Clear human personnel from the lift landing zone.",
    "Boiler B-50": "TARGET: Steam Boiler B-50 (Sector 2 Powerhouse)\nCRITICAL THRESHOLD: Water Level < 10% or Steam Pressure > 15 Bar\nPROTOCOL: Low water levels risk boiler dry-firing and vessel explosion.\nACTION 1: Cut fuel gas feed supply to the boiler burner.\nACTION 2: Start emergency auxiliary water feed pump AP-50.\nACTION 3: Vent excess steam to the atmosphere via pressure release valve.",
    "Gas Flare System GF-8": "TARGET: Hydrocarbon Gas Flare System GF-8\nCRITICAL FAULT: Flameout detected or Flare stack pressure > 3 Bar\nPROTOCOL: Flare flameout risks releasing toxic raw hydrocarbon gases into the environment.\nACTION 1: Trigger automated electronic re-ignition system.\nACTION 2: Open purge gas supply to maintain positive flow.\nACTION 3: Divert raw gas stream to emergency vapor recovery unit.",
    "Transformer T-1": "TARGET: Substation Main Power Transformer T-1\nCRITICAL THRESHOLD: Oil Temperature > 95°C or Gas in Oil > 150 ppm\nPROTOCOL: High winding temperature or high dissolved gas indicates arcing or electrical winding fault.\nACTION 1: Isolate T-1 from the high-voltage utility grid lines.\nACTION 2: Start auxiliary oil cooling fans and pumps.\nACTION 3: Route substation loads to standby transformer T-2.",
    "EV Battery Vat 4": "TARGET: EV Battery Charging & Storage Vat 4\nCRITICAL THRESHOLD: State of Charge > 95% or Thermal Spike > 65°C\nPROTOCOL: High temperatures during rapid charge risk thermal runaway or catastrophic cell degradation.\nACTION 1: Immediately disconnect charging power supply lines.\nACTION 2: Activate high-capacity liquid nitrogen cooling shroud.\nACTION 3: Displace atmosphere with argon gas fire suppressant in Sector 1.",
    "Cooling Tower 1": "TARGET: Secondary Water Cooling Tower 1\nCRITICAL THRESHOLD: Fan Vibration > 8.0 mm/s or Fan Motor Temp > 90°C\nPROTOCOL: Excessive vibration indicates mechanical imbalance or blade structural damage.\nACTION 1: Shut down the primary fan assembly.\nACTION 2: Shift load entirely to standby Cooling Tower 2.\nACTION 3: Restrict operator access to the tower deck until inspected.",
    "Emergency Flare Stack EFS-3": "TARGET: High-Pressure Emergency Flare Stack EFS-3\nCRITICAL THRESHOLD: Gas flow > 50 kg/s or pilot light failure\nPROTOCOL: Pilot failure during high-volume venting risks release of raw hydrocarbons.\nACTION 1: Trigger remote electronic spark ignition backup.\nACTION 2: Route venting gas to secondary scrubber tank.\nACTION 3: Issue localized evacuation warning to surrounding plant sectors.",
    "Centrifugal Compressor C-401": "TARGET: High-Pressure Process Gas Compressor C-401\nCRITICAL THRESHOLD: Surge margin < 5% or Discharge Temp > 150°C\nPROTOCOL: Compressor surge causes rapid torque spikes and can destroy rotor blades.\nACTION 1: Open the anti-surge recycle valve to 100%.\nACTION 2: Throttling intake valve to reduce mass flow rate.\nACTION 3: Engage auxiliary lube oil pump to protect bearings during deceleration.",
    "Steam Turbine ST-5": "TARGET: Power Generation Steam Turbine ST-5\nCRITICAL THRESHOLD: Shaft speed > 3150 RPM or Winding Temp > 115°C\nPROTOCOL: Over-speed condition risks catastrophic blade ejection and turbine disintegration.\nACTION 1: Activate emergency stop trip valve to cut high-pressure steam supply.\nACTION 2: Engage mechanical rotor brake once speed drops below 1000 RPM.\nACTION 3: Open generator breaker to isolate turbine from the power grid.",
    "Nitrogen Purge Unit NPU-12": "TARGET: Sector 2 Gas Inerting Unit NPU-12\nCRITICAL THRESHOLD: Nitrogen Purity < 99% or Discharge Pressure < 6 Bar\nPROTOCOL: Inadequate nitrogen purity fails to inert reactor vessels, increasing explosion risk.\nACTION 1: Switch system input to standby high-purity nitrogen storage tank.\nACTION 2: Close line valve V-N2-12 to isolate downstream process lines.\nACTION 3: Initiate line blowdown to purge impure gas.",
    "Storage Tank ST-300": "TARGET: Toxic Waste Storage Tank ST-300\nCRITICAL THRESHOLD: Liquid Level > 95% or Leak Detector = ALARM\nPROTOCOL: Tank overflow or wall compromise poses an immediate environmental and biological hazard.\nACTION 1: Shut off all incoming transfer pumps.\nACTION 2: Divert overflow stream to containment sump tank ST-301.\nACTION 3: Dispatch emergency hazmat response team to secure the secondary containment bund."
}

async def migrate_blueprints():
    """Migrates blueprints from database.json to SQLite and ensures all default blueprints exist."""
    db_data = {}
    if os.path.exists(DATABASE_JSON_PATH):
        try:
            with open(DATABASE_JSON_PATH, "r", encoding="utf-8") as f:
                db_data = json.load(f)
        except Exception as e:
            logger.error(f"Failed to read database.json: {e}")

    try:
        async with aiosqlite.connect(DB_PATH) as db:
            # Surgical cleanup of old/duplicate blueprints
            await db.execute("DELETE FROM blueprints WHERE name IN ('Vat 4', 'Unknown Equipment', 'Test')")
            await db.commit()

            # First, check what blueprints are currently in the database
            async with db.execute("SELECT name FROM blueprints") as cursor:
                rows = await cursor.fetchall()
                existing_names = {row[0] for row in rows}

            # Ingest from database.json first
            for name, spec in db_data.items():
                if name not in existing_names:
                    if not isinstance(spec, str):
                        from dynamic_db import format_spec_to_str
                        spec_str = format_spec_to_str(spec)
                    else:
                        spec_str = spec
                    await db.execute(
                        "INSERT OR IGNORE INTO blueprints (name, spec) VALUES (?, ?)",
                        (name, spec_str)
                    )
                    existing_names.add(name)

            # Ingest any missing default blueprints (including the 7 new ones)
            for name, spec in DEFAULT_BLUEPRINTS.items():
                if name not in existing_names:
                    await db.execute(
                        "INSERT OR IGNORE INTO blueprints (name, spec) VALUES (?, ?)",
                        (name, spec)
                    )
            await db.commit()
            logger.info("Blueprints initialization and seed complete.")
    except Exception as e:
        logger.error(f"Failed to migrate/seed blueprints: {e}")

async def get_history(page: int = 1, limit: int = 50):
    """Retrieves paginated history records sorted by timestamp descending."""
    offset = (page - 1) * limit
    records = []
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM history ORDER BY timestamp DESC LIMIT ? OFFSET ?", 
            (limit, offset)
        ) as cursor:
            async for row in cursor:
                try:
                    logs_val = json.loads(row["logs"])
                except Exception:
                    logs_val = []
                records.append({
                    "id": row["id"],
                    "timestamp": row["timestamp"],
                    "alert_text": row["alert_text"],
                    "equipment": row["equipment"],
                    "status": row["status"],
                    "latency": row["latency"],
                    "logs": logs_val,
                    "report": row["report"]
                })
    return records

async def save_history_record(alert_text: str, equipment: str, status: str, latency: float, logs: list, report: str) -> dict:
    """Saves a new run history record to SQLite database."""
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
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO history (id, timestamp, alert_text, equipment, status, latency, logs, report) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (
                record["id"],
                record["timestamp"],
                record["alert_text"],
                record["equipment"],
                record["status"],
                record["latency"],
                json.dumps(record["logs"]),
                record["report"]
            )
        )
        await db.commit()
    return record

async def get_metrics():
    """Computes total runs, success rate, average latency, and alarms count by equipment."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT status, latency, equipment FROM history") as cursor:
            rows = await cursor.fetchall()
            
    total_runs = len(rows)
    if total_runs == 0:
        return {
            "total_runs": 0,
            "success_rate": 0,
            "avg_latency": 0,
            "alarms_by_equipment": {}
        }

    successes = sum(1 for r in rows if r["status"] == "success")
    success_rate = round((successes / total_runs) * 100, 1)
    
    total_latency = sum(r["latency"] if r["latency"] is not None else 0 for r in rows)
    avg_latency = round(total_latency / total_runs, 2)
    
    alarms = {}
    for r in rows:
        eq = r["equipment"] or "Unknown Equipment"
        alarms[eq] = alarms.get(eq, 0) + 1
        
    return {
        "total_runs": total_runs,
        "success_rate": success_rate,
        "avg_latency": avg_latency,
        "alarms_by_equipment": alarms
    }

async def get_blueprints():
    """Returns a dict of blueprint names mapped to their specifications."""
    blueprints = {}
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT name, spec FROM blueprints") as cursor:
            async for row in cursor:
                blueprints[row["name"]] = row["spec"]
    return blueprints

async def save_blueprint(name: str, spec: str):
    """Saves or updates a blueprint in the SQLite database."""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT OR REPLACE INTO blueprints (name, spec) VALUES (?, ?)",
            (name, spec)
        )
        await db.commit()

async def delete_blueprint(name: str):
    """Deletes a blueprint from the SQLite database."""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("DELETE FROM blueprints WHERE name = ?", (name,))
        await db.commit()

async def get_blueprint_spec(name: str) -> str:
    """Retrieves a single blueprint spec by name."""
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute("SELECT spec FROM blueprints WHERE name = ?", (name,)) as cursor:
            row = await cursor.fetchone()
            return row[0] if row else None


async def clear_history():
    """Clears the history table (used when resetting the sandbox)."""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("DELETE FROM history")
        await db.commit()

async def get_history_by_id(run_id: str):
    """Retrieves a single history record by its ID."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM history WHERE id = ?", (run_id,)) as cursor:
            row = await cursor.fetchone()
            if row:
                try:
                    logs_val = json.loads(row["logs"])
                except Exception:
                    logs_val = []
                return {
                    "id": row["id"],
                    "timestamp": row["timestamp"],
                    "alert_text": row["alert_text"],
                    "equipment": row["equipment"],
                    "status": row["status"],
                    "latency": row["latency"],
                    "logs": logs_val,
                    "report": row["report"]
                }
    return None

async def clear_blueprints():
    """Clears all blueprints from the database."""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("DELETE FROM blueprints")
        await db.commit()


