# api/network_scanner.py
import asyncio
import logging
from api.mock_database import ENTERPRISE_KNOWLEDGE_BASE
from api.agents import SystemsAnalystAdapter

logger = logging.getLogger("NetworkScanner")

async def simulate_network_scan_async(status_callback=None):
    """
    Simulates scanning the factory subnet 192.168.1.0/24, discovering hardware devices,
    checking if they exist in the knowledge base, and auto-ingesting missing ones.
    """
    logger.info("Starting active network scan simulation...")
    
    if status_callback:
        await status_callback("Network Scanner", "📡 Initializing SNMP & OPC-UA network scan on subnet 192.168.1.0/24...")
        await asyncio.sleep(0.6)
        await status_callback("Network Scanner", "🔍 Pinging hosts and querying active system profiles...")
        await asyncio.sleep(0.6)

    # Simulated discovery list
    discovered_devices = [
        {"ip": "192.168.1.15", "name": "Cisco Switch 2960"},
        {"ip": "192.168.1.50", "name": "Siemens S7-1200 PLC"},
        {"ip": "192.168.1.110", "name": "Caterpillar C15 Generator"},
        {"ip": "192.168.1.200", "name": "Vat 4"},
    ]

    analyst = SystemsAnalystAdapter()
    results = []

    for dev in discovered_devices:
        ip = dev["ip"]
        name = dev["name"]
        
        if status_callback:
            await status_callback("Network Scanner", f"📡 Discovered device at {ip} - **{name}**")
            await asyncio.sleep(0.3)

        # Check if device spec is already in the database
        exists = ENTERPRISE_KNOWLEDGE_BASE.get(name) is not None
        
        if exists:
            if status_callback:
                await status_callback("Network Scanner", f"   ↳ Status: **Active** (Specs already configured in local database). Skipping.")
                await asyncio.sleep(0.2)
            results.append({
                "ip": ip,
                "name": name,
                "status": "Already Active",
                "details": "Blueprint already configured in local database."
            })
        else:
            if status_callback:
                await status_callback("Network Scanner", f"   ↳ Status: **Missing Blueprint**. Triggering auto-ingestion...")
                await asyncio.sleep(0.3)
            
            # Run ingestion flow
            try:
                spec = await analyst._ingest_equipment_spec_async(name, status_callback=status_callback)
                # Check where it came from based on manuals folder structure
                import os
                manuals_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "manuals")
                source = "LLM Fallback Ingestion"
                if os.path.exists(manuals_dir):
                    for f in os.listdir(manuals_dir):
                        if name.lower().replace(" ", "") in f.lower().replace("_", "").replace("-", "") or "cisco" in f.lower() and "cisco" in name.lower() or "caterpillar" in f.lower() and "caterpillar" in name.lower() or "siemens" in f.lower() and "siemens" in name.lower():
                            source = f"Document RAG ({f})"
                            break
                
                results.append({
                    "ip": ip,
                    "name": name,
                    "status": "Ingested",
                    "details": f"Auto-ingested via {source}."
                })
            except Exception as e:
                logger.error(f"Failed to auto-ingest spec for {name}: {e}")
                results.append({
                    "ip": ip,
                    "name": name,
                    "status": "Failed",
                    "details": f"Ingestion error: {str(e)}"
                })

    if status_callback:
        await status_callback("Network Scanner", "✅ Active Network Scan Complete! All discovered assets are now configured.")
        await asyncio.sleep(0.5)

    return results
