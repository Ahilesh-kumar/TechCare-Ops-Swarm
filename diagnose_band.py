import asyncio
import os
import logging
from dotenv import load_dotenv
from band import Agent
from band.agent import SimpleAdapter

# Enable full debug logging for connections
logging.basicConfig(level=logging.DEBUG, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
load_dotenv()

class TestAdapter(SimpleAdapter[list]):
    async def on_message(self, msg, tools, history, participants_msg, contacts_msg, **kwargs):
        print(f"\n🔔 WebSocket Message Received: {msg.content}\n")

async def main():
    api_key = os.environ.get("BAND_ANALYST_TOKEN")
    analyst_id = os.environ.get("BAND_ANALYST_ID")
    
    print("=" * 60)
    print("BAND.AI PLATFORM WEBSOCKET DIAGNOSTIC")
    print("=" * 60)
    print(f"Loaded Agent Token:  {api_key[:15]}..." if api_key else "Missing BAND_ANALYST_TOKEN")
    print(f"Agent ID:           {analyst_id}" if analyst_id else "Missing BAND_ANALYST_ID")
    
    if not api_key or not analyst_id:
        print("\n❌ Error: Missing credentials in your .env file.")
        return
        
    print("\n1. Initializing agent configuration...")
    try:
        agent = Agent.create(
            adapter=TestAdapter(),
            agent_id=analyst_id,
            api_key=api_key
        )
        print("✅ Configuration initialized.")
        
        print("\n2. Attempting WebSocket connection...")
        await agent.start()
        print("✅ WebSocket connected! Agent is online on Band.ai.")
        
        print("\n3. Listening for messages for 10 seconds. Try sending a message in your chatroom...")
        await asyncio.sleep(10.0)
        
        print("\n4. Closing connection...")
        await agent.stop()
        print("✅ Agent stopped. Connection closed cleanly.")
        print("=" * 60)
        print("DIAGNOSTIC PASSED: Your API key and Agent ID are fully authenticated!")
        print("=" * 60)
    except Exception as e:
        print("\n❌ Connection Failed!")
        print(f"Error details: {e}")
        print("-" * 60)
        import traceback
        traceback.print_exc()
        print("=" * 60)

if __name__ == "__main__":
    asyncio.run(main())
