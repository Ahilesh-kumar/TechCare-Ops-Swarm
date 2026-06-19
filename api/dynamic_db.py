# dynamic_db.py
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "safeguard.db")

def format_spec_to_str(spec) -> str:
    if isinstance(spec, str):
        return spec
    if isinstance(spec, dict):
        lines = []
        for k, v in spec.items():
            if isinstance(v, list):
                lines.append(f"{k}:")
                for item in v:
                    lines.append(f"  - {item}")
            else:
                lines.append(f"{k}: {v}")
        return "\n".join(lines)
    return str(spec)

class DynamicKnowledgeBase(dict):
    """
    A dictionary subclass that dynamically reads from the SQLite safeguard.db
    on every access to prevent Python caching issues during live updates.
    Supports token-based fuzzy matching fallback when exact keys are not found.
    """
    def _load(self) -> dict:
        blueprints = {}
        try:
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            # Ensure blueprints table exists in case accessed before init_db
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS blueprints (
                    name TEXT PRIMARY KEY,
                    spec TEXT
                )
            """)
            cursor.execute("SELECT name, spec FROM blueprints")
            for name, spec in cursor.fetchall():
                blueprints[name] = spec
            conn.close()
        except Exception as e:
            print(f"Error loading blueprints from SQLite: {e}")
        return blueprints

    def _save(self, data: dict) -> None:
        try:
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            cursor.execute("DELETE FROM blueprints")
            for name, spec in data.items():
                cursor.execute(
                    "INSERT OR REPLACE INTO blueprints (name, spec) VALUES (?, ?)",
                    (name, format_spec_to_str(spec))
                )
            conn.commit()
            conn.close()
        except Exception as e:
            print(f"Error saving blueprints to SQLite: {e}")

    def _fuzzy_match(self, query_key: str, blueprints: dict) -> str | None:
        if not query_key:
            return None
            
        query_lower = query_key.lower()
        
        # 1. Direct substring matches (e.g. "Press 7" in "Pneumatic Press 7")
        for name in blueprints.keys():
            name_lower = name.lower()
            if query_lower in name_lower or name_lower in query_lower:
                return name
                
        # 2. Token overlap matches
        stop_words = {"the", "a", "an", "system", "main", "sector", "block", "unit", "and", "or", "equipment"}
        query_words = set(w for w in query_lower.replace("-", " ").replace("_", " ").split() if w not in stop_words)
        
        best_match = None
        max_overlap = 0
        
        for name in blueprints.keys():
            name_lower = name.lower()
            name_words = set(w for w in name_lower.replace("-", " ").replace("_", " ").split() if w not in stop_words)
            overlap = len(query_words.intersection(name_words))
            if overlap > max_overlap:
                max_overlap = overlap
                best_match = name
                
        if max_overlap > 0:
            return best_match
            
        return None

    def get(self, key, default=None):
        data = self._load()
        if key in data:
            return data[key]
        
        matched_key = self._fuzzy_match(key, data)
        if matched_key:
            print(f"INFO: Fuzzy-matched knowledge base query '{key}' to entry '{matched_key}'")
            return data[matched_key]
        return default

    def __getitem__(self, key):
        data = self._load()
        if key in data:
            return data[key]
            
        matched_key = self._fuzzy_match(key, data)
        if matched_key:
            print(f"INFO: Fuzzy-matched knowledge base query '{key}' to entry '{matched_key}'")
            return data[matched_key]
        raise KeyError(key)

    def __contains__(self, key):
        data = self._load()
        if key in data:
            return True
        return self._fuzzy_match(key, data) is not None

    def items(self):
        return self._load().items()

    def keys(self):
        return self._load().keys()

    def values(self):
        return self._load().values()

    def __len__(self):
        return len(self._load())

    def update_spec(self, name: str, spec) -> None:
        try:
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            cursor.execute(
                "INSERT OR REPLACE INTO blueprints (name, spec) VALUES (?, ?)",
                (name, format_spec_to_str(spec))
            )
            conn.commit()
            conn.close()
        except Exception as e:
            print(f"Error updating blueprint in SQLite: {e}")

    def delete_spec(self, name: str) -> None:
        try:
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            cursor.execute("DELETE FROM blueprints WHERE name = ?", (name,))
            conn.commit()
            conn.close()
        except Exception as e:
            print(f"Error deleting blueprint from SQLite: {e}")

ENTERPRISE_KNOWLEDGE_BASE = DynamicKnowledgeBase()
