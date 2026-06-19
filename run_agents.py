import asyncio
import os
import sys
import logging
from dotenv import load_dotenv

# Ensure the root directory is in python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from api.agents import (
        create_coordinator_agent, create_analyst_agent, create_auditor_agent,
        create_execution_agent, create_forensic_agent, create_curator_agent
    )
except ImportError:
    from agents import (
        create_coordinator_agent, create_analyst_agent, create_auditor_agent,
        create_execution_agent, create_forensic_agent, create_curator_agent
    )

# Enable logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("BandAgentRunner")

load_dotenv()

async def run_agent_with_retry(name, agent_factory, *args, startup_delay: float = 0.0, **kwargs):
    """
    Runs an agent with an exponential backoff reconnect loop.
    Prevents temporary network issues or platform restarts from crashing the runner.
    """
    if startup_delay > 0:
        logger.info(f"Staggering startup: waiting {startup_delay}s before starting agent '{name}'...")
        await asyncio.sleep(startup_delay)

    backoff = 2
    while True:
        agent = None
        try:
            logger.info(f"Starting agent '{name}'...")
            agent = agent_factory(*args, **kwargs)
            await agent.start()
            logger.info(f"Agent '{name}' is ONLINE and connected to Band.ai!")
            backoff = 2  # Reset backoff on successful connection
            await agent.run_forever()
        except asyncio.CancelledError:
            logger.info(f"Shutdown requested for agent '{name}'...")
            if agent and agent.is_running:
                await agent.stop()
            break
        except Exception as e:
            logger.error(f"Agent '{name}' disconnected due to error: {e}")
            if agent:
                try:
                    await agent.stop()
                except Exception:
                    pass
            
            # Check for rate-limiting, supersede, or session already connected errors
            err_str = str(e).lower()
            if "rate-limit" in err_str or "429" in err_str or "supersede" in err_str or "already_connected" in err_str or "session.already_connected" in err_str:
                # Set a much longer sleep time (45-60 seconds) to avoid connection wars and allow other instances to stay stable
                sleep_time = 45.0
                logger.warning(f"WARNING: Agent '{name}' hit a connection conflict or rate-limit (supersede/already_connected).")
                logger.warning(f"  To avoid connection wars, backing off for {sleep_time} seconds before retrying...")
            else:
                sleep_time = backoff
                backoff = min(backoff * 2, 60)
                
            logger.info(f"Retrying connection for agent '{name}' in {sleep_time} seconds...")
            await asyncio.sleep(sleep_time)

async def main():
    # Load IDs from environment
    coordinator_id = os.environ.get("BAND_COORDINATOR_ID")
    analyst_id = os.environ.get("BAND_ANALYST_ID")
    auditor_id = os.environ.get("BAND_AUDITOR_ID")
    execution_id = os.environ.get("BAND_EXECUTION_ID")
    forensic_id = os.environ.get("BAND_FORENSIC_ID")
    curator_id = os.environ.get("BAND_CURATOR_ID")

    # Load Agent Secret Tokens
    coordinator_token = os.environ.get("BAND_COORDINATOR_TOKEN")
    analyst_token = os.environ.get("BAND_ANALYST_TOKEN")
    auditor_token = os.environ.get("BAND_AUDITOR_TOKEN")
    execution_token = os.environ.get("BAND_EXECUTION_TOKEN")
    forensic_token = os.environ.get("BAND_FORENSIC_TOKEN")
    curator_token = os.environ.get("BAND_CURATOR_TOKEN")

    print("=" * 60)
    print("      BAND.AI PERSISTENT BACKGROUND AGENTS RUNNER")
    print("=" * 60)
    
    missing_vars = []
    if not coordinator_id or not coordinator_token:
        missing_vars.append("BAND_COORDINATOR_ID / BAND_COORDINATOR_TOKEN")
    if not analyst_id or not analyst_token:
        missing_vars.append("BAND_ANALYST_ID / BAND_ANALYST_TOKEN")
    if not auditor_id or not auditor_token:
        missing_vars.append("BAND_AUDITOR_ID / BAND_AUDITOR_TOKEN")

    if missing_vars:
        print("\nERROR: Missing mandatory Agent credentials in your .env file.")
        print("Please ensure the following variables are configured:")
        for var in missing_vars:
            print(f"  - {var}")
        print("\nHow to get Agent Secret Tokens:")
        print("  1. Go to app.band.ai -> Agents tab.")
        print("  2. Click the '...' menu on the top-right corner of each agent card.")
        print("  3. Copy the 'Agent Secret Token' / 'API Key'.")
        print("  4. Save them in your .env file as:")
        print("       BAND_COORDINATOR_TOKEN=band_a_...")
        print("       BAND_ANALYST_TOKEN=band_a_...")
        print("       BAND_AUDITOR_TOKEN=band_a_...")
        print("=" * 60)
        return

    print("Initializing auto-reconnecting agent runner tasks...")
    print(f"  - Coordinator: {coordinator_id}")
    print(f"  - Systems Analyst: {analyst_id}")
    print(f"  - Safety Auditor: {auditor_id}")

    tasks = [
        run_agent_with_retry(
            "Coordinator", 
            create_coordinator_agent, 
            agent_id=coordinator_id, 
            api_key=coordinator_token, 
            analyst_id=analyst_id,
            startup_delay=0.0
        ),
        run_agent_with_retry(
            "Systems Analyst", 
            create_analyst_agent, 
            agent_id=analyst_id, 
            api_key=analyst_token, 
            auditor_id=auditor_id,
            startup_delay=1.0
        ),
        run_agent_with_retry(
            "Safety Auditor", 
            create_auditor_agent, 
            agent_id=auditor_id, 
            api_key=auditor_token,
            execution_id=execution_id or "execution_agent",
            startup_delay=2.0
        )
    ]

    if execution_id and execution_token:
        print(f"  - Execution Agent: {execution_id}")
        tasks.append(
            run_agent_with_retry(
                "Execution Agent",
                create_execution_agent,
                agent_id=execution_id,
                api_key=execution_token,
                forensic_id=forensic_id,
                startup_delay=3.0
            )
        )
    else:
        print("  - Execution Agent: [SKIPPED - not configured in .env]")

    if forensic_id and forensic_token:
        print(f"  - Forensic Investigator: {forensic_id}")
        tasks.append(
            run_agent_with_retry(
                "Forensic Agent",
                create_forensic_agent,
                agent_id=forensic_id,
                api_key=forensic_token,
                curator_id=curator_id,
                startup_delay=4.0
            )
        )
    else:
        print("  - Forensic Investigator: [SKIPPED - not configured in .env]")

    if curator_id and curator_token:
        print(f"  - Knowledge Curator: {curator_id}")
        tasks.append(
            run_agent_with_retry(
                "Knowledge Curator Agent",
                create_curator_agent,
                agent_id=curator_id,
                api_key=curator_token,
                startup_delay=5.0
            )
        )
    else:
        print("  - Knowledge Curator: [SKIPPED - not configured in .env]")

    print("-" * 60)

    try:
        # Spawn configured agent tasks concurrently
        await asyncio.gather(*tasks)
    except KeyboardInterrupt:
        print("\nStopping background agents...")
    except Exception as e:
        logger.error(f"Runner failed with error: {e}")
    finally:
        print("=" * 60)
        print("Agent runner stopped.")
        print("=" * 60)

if __name__ == "__main__":
    import socket
    try:
        # Use port 18274 as a singleton lock
        _lock_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        _lock_socket.bind(("127.0.0.1", 18274))
    except socket.error:
        print("\nERROR: Another instance of run_agents.py is already running!")
        print("Please stop the existing instance before starting a new one.")
        sys.exit(1)

    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
