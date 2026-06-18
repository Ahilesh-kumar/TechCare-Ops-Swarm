"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Flame,
  Server,
  Cpu,
  Play,
  CheckCircle2,
  Download,
  Copy,
  Activity,
  Settings,
  ShieldAlert,
  Terminal,
  Radio,
  FileText,
  UserCheck,
  Zap,
  Droplets,
  Wrench,
  Database,
  History,
  FileCode,
  Plus,
  Trash2,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
} from "lucide-react";

interface SwarmLog {
  agent: string;
  text: string;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState("control");
  const [alertInput, setAlertInput] = useState("");
  const [swarmLogs, setSwarmLogs] = useState<SwarmLog[]>([]);
  const [finalReport, setFinalReport] = useState("");
  const [activeEquipment, setActiveEquipment] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [resultsView, setResultsView] = useState<"console" | "report">("console");
  
  // Calibration panel configurations
  const [networkMode, setNetworkMode] = useState("Offline Simulation Sandbox");
  const [autoTrigger, setAutoTrigger] = useState(true);
  const [stepDelay, setStepDelay] = useState(0.1);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Dynamic sandbox states
  const [blueprints, setBlueprints] = useState<Record<string, string>>({});
  const [selectedBlueprint, setSelectedBlueprint] = useState("");
  const [blueprintSpec, setBlueprintSpec] = useState("");
  const [showAddBlueprint, setShowAddBlueprint] = useState(false);
  const [newBlueprintName, setNewBlueprintName] = useState("");
  const [newBlueprintSpec, setNewBlueprintSpec] = useState("");

  const [prompts, setPrompts] = useState({
    coordinator: "",
    analyst: "",
    auditor: "",
    execution: "",
    forensic: "",
    curator: "",
  });
  const [isSavingPrompts, setIsSavingPrompts] = useState(false);

  const [history, setHistory] = useState<any[]>([]);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<any | null>(null);

  const [metrics, setMetrics] = useState({
    total_runs: 0,
    success_rate: 0,
    avg_latency: 0,
    alarms_by_equipment: {} as Record<string, number>,
  });

  const [equipmentStatus, setEquipmentStatus] = useState<any[]>([]);

  // Active Network Scanner states
  const [isScanningNetwork, setIsScanningNetwork] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);
  const [scanLogs, setScanLogs] = useState<SwarmLog[]>([]);
  const [scanResults, setScanResults] = useState<any[]>([]);

  const logsEndRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Helper to parse markdown bold syntax **word**
  const renderMarkdownText = (text: string) => {
    if (!text) return "";
    const parts = text.split("**");
    return parts.map((part, i) => {
      if (i % 2 === 1) {
        return <strong key={i} className="font-extrabold text-slate-955 bg-slate-100 px-1 py-0.5 rounded">{part}</strong>;
      }
      return part;
    });
  };

  // Helper to parse dynamic incident report styled like Gemini document
  const renderReportDocument = (reportText: string, equipmentName?: string) => {
    if (!reportText) return null;

    // Normalize newlines and split by line
    const lines = reportText.split("\n");
    const renderedElements: React.ReactNode[] = [];
    let listBuffer: React.ReactNode[] = [];
    
    const flushList = (key: number) => {
      if (listBuffer.length === 0) return null;
      const list = (
        <div key={`list-${key}`} className="space-y-2.5 my-3">
          {[...listBuffer]}
        </div>
      );
      listBuffer = [];
      return list;
    };

    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) {
        // Flush any active list
        if (listBuffer.length > 0) {
          renderedElements.push(flushList(idx));
        }
        return;
      }

      // Check for headings (e.g. ### EXECUTIVE SUMMARY or similar without inline text)
      if (trimmed.startsWith("#") || (trimmed.startsWith("###") && !trimmed.includes(":") && trimmed.length < 60)) {
        // Flush any active list
        if (listBuffer.length > 0) {
          renderedElements.push(flushList(idx));
        }
        
        // Clean up hashes and colons at the end of heading
        const headingText = trimmed.replace(/^#+\s+/, "").replace(/:$/, "").trim();
        renderedElements.push(
          <h3 key={idx} className="text-sm font-bold text-slate-800 tracking-wide mt-6 mb-2 first:mt-2">
            {headingText}
          </h3>
        );
        return;
      }

      // Check if line starts with bullet indicators
      const isBullet = trimmed.startsWith("-") || trimmed.startsWith("*") || trimmed.startsWith("o");
      const isNumbered = /^\d+\./.test(trimmed);

      if (isBullet || isNumbered) {
        let prefix = "◦";
        let content = trimmed;

        if (trimmed.startsWith("-") || trimmed.startsWith("*")) {
          content = trimmed.slice(1).trim();
        } else if (trimmed.startsWith("o")) {
          content = trimmed.slice(1).trim();
        } else {
          const match = trimmed.match(/^(\d+)\.\s+(.*)/);
          if (match) {
            prefix = match[1] + ".";
            content = match[2];
          }
        }

        listBuffer.push(
          <div key={`item-${idx}`} className="flex items-start gap-3 pl-2 text-xs text-slate-600 leading-relaxed font-normal">
            <span className={`text-slate-400 font-bold select-none shrink-0 ${isNumbered ? "text-[10px] w-4 text-right" : ""}`}>
              {prefix}
            </span>
            <div className="flex-1 font-normal text-slate-600">{renderMarkdownText(content)}</div>
          </div>
        );
        return;
      }

      // If we reach here, it's a normal text line
      // Flush any active list
      if (listBuffer.length > 0) {
        renderedElements.push(flushList(idx));
      }

      // Check if this line is actually an inline header (e.g. starts with "### EXECUTIVE SUMMARY:")
      if (trimmed.startsWith("###")) {
        const headerMatch = trimmed.match(/^###\s*([^:]+):\s*(.*)/);
        if (headerMatch) {
          const headingText = headerMatch[1].trim();
          const remainingText = headerMatch[2].trim();
          
          renderedElements.push(
            <h3 key={`h-${idx}`} className="text-sm font-bold text-slate-800 tracking-wide mt-6 mb-2">
              {headingText}
            </h3>
          );
          
          if (remainingText) {
            renderedElements.push(
              <p key={`p-${idx}`} className="text-xs text-slate-600 leading-relaxed mb-4 font-normal">
                {renderMarkdownText(remainingText)}
              </p>
            );
          }
          return;
        }
      }

      // Plain paragraph line
      renderedElements.push(
        <p key={idx} className="text-xs text-slate-600 leading-relaxed mb-4 font-normal">
          {renderMarkdownText(trimmed)}
        </p>
      );
    });

    // Flush any remaining list items
    if (listBuffer.length > 0) {
      renderedElements.push(flushList(lines.length));
    }

    const reportTitle = equipmentName 
      ? `Incident Report: ${equipmentName} Mitigation`
      : selectedBlueprint 
      ? `Incident Report: ${selectedBlueprint} Mitigation` 
      : "Incident Report: Swarm Safety Mitigation";

    return (
      <div className="space-y-4 text-left">
        <h2 className="text-lg font-medium text-slate-900 border-b border-slate-150 pb-4 mb-6 tracking-tight">
          {reportTitle}
        </h2>
        <div className="space-y-1">
          {renderedElements}
        </div>
      </div>
    );
  };

  // Scroll to bottom of logs when they update
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [swarmLogs]);

  // Handle timer for swarm execution duration
  useEffect(() => {
    if (isRunning) {
      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        setElapsedTime(Number(((Date.now() - startTime) / 1000).toFixed(2)));
      }, 50);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning]);

  // Fetch all databases & configurations from the API
  const fetchAllData = useCallback(async () => {
    try {
      // 1. Fetch Blueprints
      const bpRes = await fetch("/api/blueprints");
      if (bpRes.ok) {
        const bpData = await bpRes.json();
        setBlueprints(bpData);
        if (Object.keys(bpData).length > 0) {
          // Keep current selection or default to first
          const currentSelect = selectedBlueprint && bpData[selectedBlueprint] ? selectedBlueprint : Object.keys(bpData)[0];
          setSelectedBlueprint(currentSelect);
          setBlueprintSpec(bpData[currentSelect]);
        }
      }

      // 2. Fetch Prompts
      const prRes = await fetch("/api/prompts");
      if (prRes.ok) {
        const prData = await prRes.json();
        setPrompts(prData);
      }

      // 3. Fetch History
      const hiRes = await fetch("/api/history");
      if (hiRes.ok) {
        const hiData = await hiRes.json();
        setHistory(hiData);
      }

      // 4. Fetch Metrics
      const mtRes = await fetch("/api/metrics");
      if (mtRes.ok) {
        const mtData = await mtRes.json();
        setMetrics(mtData);
      }

      // 5. Fetch Equipment Health Status
      const eqRes = await fetch("/api/equipment");
      if (eqRes.ok) {
        const eqData = await eqRes.json();
        setEquipmentStatus(eqData);
      }
    } catch (err) {
      console.error("Failed to sync backend sandbox state", err);
    }
  }, [selectedBlueprint]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Telemetry presets text mapper
  const getPresetText = (name: string) => {
    if (name === "Vat 4") {
      return "Emergency: EV Battery Vat 4 core temperature just hit 180°C. Do I shut down the line?";
    }
    if (name === "Server Rack B") {
      return "CRITICAL WARNING: Financial Database Server Rack B ambient temperature spiked to 85°C. Immediate thermal control required.";
    }
    if (name === "Robotic Arm 9") {
      return "ALERT: Conveyor Robotic Arm 9 motor has stalled with high torque resistance for over 5 seconds. Human safety risk.";
    }
    if (name === "Cooling Tower 2") {
      return "CRITICAL FAULT: Main Water Cooling Tower 2 water flow rate dropped to 8 L/s with return water temperature at 48°C. Explosion hazard.";
    }
    if (name === "Main Generator Block A") {
      return "GRID INSTABILITY ALERT: Power Supply Main Generator Block A output frequency fluctuates to 61.2 Hz. Equipment damage risk.";
    }
    if (name === "Pneumatic Press 7") {
      return "SAFETY TRIP: Heavy Press Sector 3 (Pneumatic Press 7) air pressure dropped below 3.5 Bar and safety light-curtain interrupted.";
    }
    return `ALERT: Critical fault detected on ${name}. Urgent inspection and containment required.`;
  };

  const getPresetIcon = (name: string) => {
    if (name.includes("Vat")) return <Flame className="h-4 w-4 text-red-400" />;
    if (name.includes("Rack")) return <Server className="h-4 w-4 text-orange-400" />;
    if (name.includes("Arm")) return <Cpu className="h-4 w-4 text-yellow-400" />;
    if (name.includes("Tower") || name.includes("Cooling")) return <Droplets className="h-4 w-4 text-blue-400" />;
    if (name.includes("Generator")) return <Zap className="h-4 w-4 text-yellow-300" />;
    if (name.includes("Press")) return <Wrench className="h-4 w-4 text-emerald-400" />;
    return <ShieldAlert className="h-4 w-4 text-cyan-400" />;
  };

  const selectPreset = (name: string) => {
    setErrorMsg("");
    const text = getPresetText(name);
    setAlertInput(text);
    setSwarmLogs([]);
    setFinalReport("");
    setActiveEquipment("");
    
    if (autoTrigger) {
      setTimeout(() => {
        triggerSwarm(text);
      }, 100);
    }
  };

  // Trigger Swarm Flow via Server-Sent Events (SSE)
  const triggerSwarm = async (customText?: string) => {
    const textToProcess = customText !== undefined ? customText : alertInput;
    if (!textToProcess.trim() || isRunning) return;

    setIsRunning(true);
    setSwarmLogs([]);
    setFinalReport("");
    setActiveEquipment("");
    setErrorMsg("");
    setElapsedTime(0);
    setResultsView("console");

    try {
      const isLive = networkMode === "Live Band.ai Network";
      const response = await fetch("/api/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alert_text: textToProcess,
          delay: stepDelay,
          live_mode: isLive,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      if (!response.body) {
        throw new Error("Response body is not readable");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const eventData = JSON.parse(line.slice(6));
              
              if (eventData.type === "log") {
                setSwarmLogs((prev) => [
                  ...prev,
                  { agent: eventData.agent, text: eventData.text },
                ]);
                if (eventData.text.includes("Identified equipment: **")) {
                  try {
                    const equip = eventData.text.split("Identified equipment: **")[1].split("**")[0];
                    setActiveEquipment(equip);
                  } catch (e) {}
                }
              } else if (eventData.type === "report") {
                setFinalReport(eventData.report);
                setResultsView("report");
              } else if (eventData.type === "error") {
                setErrorMsg(eventData.message);
              }
            } catch (jsonErr) {
              console.error("Failed to parse SSE payload", jsonErr);
            }
          }
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected network error occurred.");
    } finally {
      setIsRunning(false);
      fetchAllData(); // Reload metrics & history logs
    }
  };

  // Save changes to the selected Blueprint specification
  const saveBlueprintSpec = async () => {
    if (!selectedBlueprint) return;
    try {
      const resp = await fetch("/api/blueprints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: selectedBlueprint, spec: blueprintSpec }),
      });
      if (resp.ok) {
        alert(`Blueprint details for "${selectedBlueprint}" updated successfully.`);
        fetchAllData();
      }
    } catch (err) {
      alert("Error saving blueprint spec.");
    }
  };

  // Delete the selected Blueprint specification
  const deleteBlueprintSpec = async () => {
    if (!selectedBlueprint) return;
    if (!confirm(`Are you sure you want to delete blueprint: ${selectedBlueprint}?`)) return;
    try {
      const resp = await fetch(`/api/blueprints/${encodeURIComponent(selectedBlueprint)}`, {
        method: "DELETE",
      });
      if (resp.ok) {
        alert(`Blueprint "${selectedBlueprint}" deleted.`);
        setSelectedBlueprint("");
        fetchAllData();
      }
    } catch (err) {
      alert("Error deleting blueprint.");
    }
  };

  // Active Network Scanner Flow (SSE Streaming)
  const startNetworkScan = async () => {
    setIsScanningNetwork(true);
    setShowScanModal(true);
    setScanLogs([]);
    setScanResults([]);

    try {
      const response = await fetch("/api/scan-network", {
        method: "POST"
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      if (!response.body) {
        throw new Error("No response body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const eventData = JSON.parse(line.slice(6));
              if (eventData.type === "log") {
                setScanLogs((prev) => [...prev, { agent: eventData.agent, text: eventData.text }]);
              } else if (eventData.type === "results") {
                setScanResults(eventData.results);
              } else if (eventData.type === "error") {
                alert("Scan Error: " + eventData.message);
              }
            } catch (e) {
              console.error("Error parsing SSE line:", e);
            }
          }
        }
      }
    } catch (err) {
      console.error("Failed to run scan:", err);
      alert("Failed to connect to network scan service.");
    } finally {
      setIsScanningNetwork(false);
      fetchAllData();
    }
  };

  // Add a brand new Blueprint specification
  const addBlueprintSpec = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBlueprintName.trim() || !newBlueprintSpec.trim()) return;
    try {
      const resp = await fetch("/api/blueprints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newBlueprintName, spec: newBlueprintSpec }),
      });
      if (resp.ok) {
        alert(`New blueprint "${newBlueprintName}" created successfully!`);
        setNewBlueprintName("");
        setNewBlueprintSpec("");
        setShowAddBlueprint(false);
        fetchAllData();
      }
    } catch (err) {
      alert("Error creating blueprint.");
    }
  };

  // Save updated System Prompts rules
  const saveAgentPrompts = async () => {
    setIsSavingPrompts(true);
    try {
      const resp = await fetch("/api/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prompts),
      });
      if (resp.ok) {
        alert("Swarm agent prompt rules updated on disk. Background daemons loaded prompts successfully!");
      } else {
        alert("Failed to save prompts.");
      }
    } catch (err) {
      alert("Error saving prompts.");
    } finally {
      setIsSavingPrompts(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(finalReport);
    alert("Safety Incident Report copied to clipboard!");
  };

  const downloadReport = () => {
    const element = document.createElement("a");
    const file = new Blob([finalReport], { type: "text/markdown" });
    element.href = URL.createObjectURL(file);
    element.download = "TechCare_Swarm_Incident_Report.md";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const resetSandbox = async () => {
    if (!confirm("Are you sure you want to reset the sandbox? This will purge all history, restore all default equipment blueprints, and reset agent rules to factory defaults.")) return;
    try {
      const resp = await fetch("/api/reset", { method: "POST" });
      if (resp.ok) {
        alert("Sandbox database and agent rules reset to factory defaults successfully!");
        fetchAllData();
      } else {
        alert("Failed to reset sandbox.");
      }
    } catch (err) {
      alert("Error resetting sandbox.");
    }
  };

  return (
    <div className="flex h-screen w-full bg-[#f6f8fc] overflow-hidden text-slate-800 font-sans">
      {/* ---------------- SIDEBAR (Swarm Control Panel) ---------------- */}
      <aside className="w-80 bg-[#f6f8fc] border-r border-slate-200 flex flex-col justify-between p-6 shrink-0 z-10">
        <div className="space-y-6 flex-1 flex flex-col overflow-hidden">
          {/* Dashboard Header */}
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#0b57d0] text-white rounded-2xl shadow-sm">
              <Activity className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <h2 className="font-bold text-base tracking-tight text-slate-800">
                TechCare Swarm
              </h2>
              <p className="text-[9px] text-[#0b57d0] font-bold uppercase tracking-wider">
                Industrial Containment
              </p>
            </div>
          </div>

          <hr className="border-slate-200" />

          {/* Navigation Menu */}
          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab("control")}
              className={`w-full flex items-center gap-3 px-5 py-2.5 rounded-full text-xs font-bold transition ${
                activeTab === "control"
                  ? "bg-[#c2e7ff] text-[#001d35] shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
              }`}
            >
              <Terminal className="h-4 w-4" />
              <span>Control Center</span>
            </button>

            <button
              onClick={() => setActiveTab("blueprints")}
              className={`w-full flex items-center gap-3 px-5 py-2.5 rounded-full text-xs font-bold transition ${
                activeTab === "blueprints"
                  ? "bg-[#c2e7ff] text-[#001d35] shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
              }`}
            >
              <Database className="h-4 w-4" />
              <span>Blueprints Manager</span>
            </button>

            <button
              onClick={() => setActiveTab("prompts")}
              className={`w-full flex items-center gap-3 px-5 py-2.5 rounded-full text-xs font-bold transition ${
                activeTab === "prompts"
                  ? "bg-[#c2e7ff] text-[#001d35] shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
              }`}
            >
              <FileCode className="h-4 w-4" />
              <span>Agent Prompts</span>
            </button>

            <button
              onClick={() => setActiveTab("history")}
              className={`w-full flex items-center gap-3 px-5 py-2.5 rounded-full text-xs font-bold transition ${
                activeTab === "history"
                  ? "bg-[#c2e7ff] text-[#001d35] shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
              }`}
            >
              <History className="h-4 w-4" />
              <span>Incident History</span>
            </button>
          </nav>

          <hr className="border-slate-200" />

          {/* Active Agents Roster */}
          <div className="space-y-3 flex-1 overflow-y-auto pr-1">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              Live Swarm Status
            </h3>
            
            {/* Coordinator Info */}
            <div className="flex items-center justify-between p-2.5 bg-white/[0.01] rounded-lg border border-white/[0.04]">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-blue-500/10 text-blue-400 rounded">
                  <Terminal className="h-4.5 w-4.5" />
                </div>
                <div className="text-left">
                  <div className="text-xs font-semibold text-gray-200">Coordinator</div>
                  <div className="text-[9px] text-gray-500">Operations Desk</div>
                </div>
              </div>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
              </span>
            </div>

            {/* Analyst Info */}
            <div className="flex items-center justify-between p-2.5 bg-white/[0.01] rounded-lg border border-white/[0.04]">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-yellow-500/10 text-yellow-400 rounded">
                  <Cpu className="h-4.5 w-4.5" />
                </div>
                <div className="text-left">
                  <div className="text-xs font-semibold text-gray-200">Systems Analyst</div>
                  <div className="text-[9px] text-gray-500">Technical Diagnostics</div>
                </div>
              </div>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
              </span>
            </div>

            {/* Auditor Info */}
            <div className="flex items-center justify-between p-2.5 bg-white/[0.01] rounded-lg border border-white/[0.04]">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded">
                  <UserCheck className="h-4.5 w-4.5" />
                </div>
                <div className="text-left">
                  <div className="text-xs font-semibold text-gray-200">Safety Auditor</div>
                  <div className="text-[9px] text-gray-500">Compliance & Audit</div>
                </div>
              </div>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
              </span>
            </div>

            <hr className="border-white/[0.06] my-4" />

            {/* Critical Systems Health */}
            <div className="space-y-2">
              <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center justify-between">
                <span>Critical Systems Health</span>
                <span className="text-[9px] text-cyan-400 font-extrabold uppercase">Live Feed</span>
              </h3>
              
              {equipmentStatus.length === 0 ? (
                <div className="text-[10px] text-gray-500 italic">Calculating health data...</div>
              ) : (
                equipmentStatus.map((eq) => {
                  let statusBg = "bg-emerald-500/10 border-emerald-500/20 text-emerald-400";
                  let healthColor = "bg-emerald-500";
                  
                  if (eq.status === "CRITICAL") {
                    statusBg = "bg-red-500/10 border-red-500/20 text-red-400";
                    healthColor = "bg-red-500 animate-pulse";
                  } else if (eq.status === "WARNING") {
                    statusBg = "bg-yellow-500/10 border-yellow-500/20 text-yellow-400";
                    healthColor = "bg-yellow-500";
                  }
                  
                  return (
                    <div key={eq.name} className="p-2 bg-white/[0.01] rounded-lg border border-white/[0.04] space-y-1 text-left">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-semibold text-gray-300">{eq.name}</span>
                        <span className={`text-[8px] font-bold px-1 py-0.2 rounded border ${statusBg}`}>
                          {eq.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-white/[0.05] h-1 rounded-full overflow-hidden">
                          <div className={`h-full ${healthColor}`} style={{ width: `${eq.health_score}%` }}></div>
                        </div>
                        <span className="text-[9px] font-bold text-gray-400 w-6 text-right">{eq.health_score}%</span>
                      </div>
                      <div className="text-[8px] text-gray-500 flex justify-between">
                        <span>Alarms: {eq.incidents_count}</span>
                        <span>Last: {eq.last_incident !== "N/A" ? new Date(eq.last_incident).toLocaleTimeString() : "Never"}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <div className="text-[10px] text-gray-500 space-y-1 mt-6 border-t border-white/[0.05] pt-4">
          <div className="font-semibold text-gray-400">TechCare Swarm Engine</div>
          <div>Inference: Llama-3.3-70B on Groq</div>
          <div>Protocols: Band SDK WebSockets</div>
          <button
            onClick={resetSandbox}
            className="w-full mt-3.5 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 text-red-400 font-semibold text-[9px] uppercase tracking-wider transition"
          >
            <Wrench className="h-3 w-3" />
            <span>Reset Sandbox Database</span>
          </button>
        </div>
      </aside>

      {/* ---------------- MAIN CONTENT AREA ---------------- */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Workspace Toolbar & System Metrics */}
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0 z-10">
          <div className="flex items-center gap-3">
            <span className="font-bold text-sm tracking-wide uppercase text-slate-800">
              Crisis Room Dashboard
            </span>
            {isRunning ? (
              <span className="text-[10px] px-2 py-0.5 bg-red-500/10 text-red-600 border border-red-500/20 font-bold rounded-full animate-pulse flex items-center gap-1">
                <Zap className="h-3 w-3 fill-red-600" />
                Swarm Active
              </span>
            ) : (
              <span className="text-[10px] px-2 py-0.5 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 font-bold rounded-full flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                Standby Ready
              </span>
            )}
          </div>

          {/* Sandbox Metrics display */}
          <div className="flex items-center gap-8 text-right">
            <div className="flex gap-6">
              <div className="space-y-0.5">
                <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Total Runs</div>
                <div className="text-sm font-bold text-[#0b57d0]">{metrics.total_runs}</div>
              </div>
              <div className="space-y-0.5">
                <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Success Rate</div>
                <div className="text-sm font-bold text-emerald-600">{metrics.success_rate}%</div>
              </div>
              <div className="space-y-0.5">
                <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Avg Latency</div>
                <div className="text-sm font-bold text-amber-600">{metrics.avg_latency}s</div>
              </div>
            </div>

            {isRunning && (
              <div className="bg-slate-100 border border-slate-200 px-3.5 py-1.5 rounded-lg text-xs font-bold text-[#0b57d0] flex items-center gap-2 shadow-sm">
                <Clock className="h-3.5 w-3.5 animate-spin" />
                <span>{elapsedTime}s</span>
              </div>
            )}
          </div>
        </header>

        {/* Dynamic Screen Tab Contents */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          
          {/* TAB 1: CONTROL CENTER */}
          {activeTab === "control" && (
            <div className="space-y-6 max-w-6xl mx-auto">
              {/* Telemetry Presets Section */}
              <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <ShieldAlert className="h-4.5 w-4.5 text-amber-500" />
                    <span>1. Telemetry Alert Scenario Presets</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 ml-6.5">
                    Click a blueprint preset below to immediately test the swarm containment protocol:
                  </p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {Object.keys(blueprints).length === 0 ? (
                    <div className="col-span-3 text-xs text-slate-400 font-semibold text-center py-2">
                      No blueprints loaded. Add custom blueprints in the Blueprints Manager.
                    </div>
                  ) : (
                    Object.keys(blueprints).map((name) => (
                      <button
                        key={name}
                        onClick={() => selectPreset(name)}
                        disabled={isRunning}
                        className="flex items-center gap-3 py-2.5 px-4 text-xs font-bold border border-slate-200 bg-slate-50/50 rounded-xl hover:bg-blue-50/50 hover:border-blue-300 hover:text-blue-700 transition text-left disabled:opacity-50"
                      >
                        {getPresetIcon(name)}
                        <span>{name}</span>
                      </button>
                    ))
                  )}
                </div>

                {/* Textarea fields for alert text */}
                <div className="space-y-1.5 pt-2">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                      Active Telemetry Log Text:
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={autoTrigger}
                        onChange={(e) => setAutoTrigger(e.target.checked)}
                        className="rounded border-slate-300 text-[#0b57d0] focus:ring-[#0b57d0] h-3.5 w-3.5"
                      />
                      <span className="text-[10px] font-semibold text-slate-500">
                        Auto-Trigger Swarm on selection
                      </span>
                    </label>
                  </div>
                  <textarea
                    value={alertInput}
                    onChange={(e) => setAlertInput(e.target.value)}
                    placeholder="Click a preset above or type your custom incident log..."
                    disabled={isRunning}
                    className="w-full text-xs border border-slate-200 bg-slate-50/50 rounded-lg p-3 h-24 focus:outline-none focus:ring-1 focus:ring-[#0b57d0] font-sans text-slate-800 placeholder-slate-400 disabled:opacity-50"
                  />
                </div>

                <div className="flex justify-between items-center pt-2">
                  {/* Calibration parameters */}
                  <div className="flex items-center gap-6">
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] font-bold text-slate-500 uppercase">Sandbox Mode</span>
                      <select
                        value={networkMode}
                        onChange={(e) => setNetworkMode(e.target.value)}
                        disabled={isRunning}
                        className="text-xs bg-white border border-slate-200 rounded-md py-1 px-2.5 focus:outline-none focus:ring-1 focus:ring-[#0b57d0] disabled:opacity-50 text-slate-700 font-medium"
                      >
                        <option>Offline Simulation Sandbox</option>
                        <option>Live Band.ai Network</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1 w-48">
                      <div className="flex justify-between text-[9px] font-bold text-slate-500 uppercase">
                        <span>Step Delay</span>
                        <span className="text-[#0b57d0] font-extrabold">{stepDelay}s</span>
                      </div>
                      <input
                        type="range"
                        min="0.0"
                        max="2.0"
                        step="0.1"
                        value={stepDelay}
                        onChange={(e) => setStepDelay(parseFloat(e.target.value))}
                        disabled={isRunning}
                        className="h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#0b57d0] disabled:opacity-50"
                      />
                    </div>
                  </div>

                  <button
                    onClick={() => triggerSwarm()}
                    disabled={isRunning || !alertInput.trim()}
                    className="flex items-center gap-2 text-xs font-bold bg-[#0b57d0] hover:bg-[#0b57d0]/90 text-white py-2.5 px-6 rounded-full transition shadow-md hover:shadow-lg disabled:opacity-40"
                  >
                    <Play className="h-4 w-4 fill-white text-white" />
                    <span>Trigger Containment Swarm</span>
                  </button>
                </div>
              </section>

              {/* Swarm logs & report display */}
              <div className="space-y-4">
                {/* Layout Mode Toggles */}
                <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-1 shrink-0">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setResultsView("console")}
                      className={`px-4 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 ${
                        resultsView === "console"
                          ? "bg-[#c2e7ff] text-[#001d35] shadow-sm"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      <Terminal className="h-3.5 w-3.5" />
                      <span>Swarm Live Console</span>
                    </button>
                    <button
                      onClick={() => setResultsView("report")}
                      className={`px-4 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 ${
                        resultsView === "report"
                          ? "bg-[#c2e7ff] text-[#001d35] shadow-sm"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      <FileText className="h-3.5 w-3.5" />
                      <span>Incident Report</span>
                    </button>
                  </div>
                  {resultsView === "report" && finalReport && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={copyToClipboard}
                        className="p-1.5 text-slate-400 hover:text-[#0b57d0] hover:bg-slate-100 rounded transition"
                        title="Copy Report text"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      <button
                        onClick={downloadReport}
                        className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-slate-100 rounded transition"
                        title="Download Report markdown"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* View Rendering */}
                {resultsView === "console" ? (
                  /* Live Swarm Console - Full Width */
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col h-[520px]">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 shrink-0">
                      Swarm Real-Time Audit Console
                    </h3>
                    <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-5 overflow-y-auto space-y-3.5 font-mono">
                      {swarmLogs.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2">
                          <Terminal className="h-8 w-8 opacity-20" />
                          <p className="text-xs">Swarm is idle. Telemetry log stream will load here.</p>
                        </div>
                      ) : (
                        swarmLogs.map((log, index) => {
                          let borderClass = "border-l-2 border-l-blue-500";
                          let badgeClass = "bg-blue-50 text-blue-700 border border-blue-200/50";
                          if (log.agent.includes("Analyst")) {
                            borderClass = "border-l-2 border-l-amber-500";
                            badgeClass = "bg-amber-50 text-amber-700 border border-amber-200/50";
                          } else if (log.agent.includes("Auditor")) {
                            borderClass = "border-l-2 border-l-emerald-500";
                            badgeClass = "bg-emerald-50 text-emerald-700 border border-emerald-200/50";
                          } else if (log.agent.includes("Execution")) {
                            borderClass = "border-l-2 border-l-purple-500";
                            badgeClass = "bg-purple-50 text-purple-700 border border-purple-200/50";
                          } else if (log.agent.includes("Forensic")) {
                            borderClass = "border-l-2 border-l-rose-500";
                            badgeClass = "bg-rose-50 text-rose-700 border border-rose-200/50";
                          } else if (log.agent.includes("Curator") || log.agent.includes("Learning")) {
                            borderClass = "border-l-2 border-l-cyan-500";
                            badgeClass = "bg-cyan-50 text-cyan-700 border border-cyan-200/50";
                          }

                          return (
                            <div
                              key={index}
                              className={`bg-white border border-slate-100 p-3 rounded-lg flex flex-col gap-1.5 shadow-sm animate-fade-in ${borderClass}`}
                            >
                              <div className="flex items-center gap-2.5">
                                <span className="text-[10px] font-bold text-slate-600">{log.agent}</span>
                                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${badgeClass}`}>
                                  {log.agent.includes("Coordinator") ? "Coordinator" :
                                   log.agent.includes("Analyst") ? "Analyst" :
                                   log.agent.includes("Auditor") ? "Auditor" :
                                   log.agent.includes("Execution") ? "Execution" :
                                   log.agent.includes("Forensic") ? "Forensic" : "Curator"}
                                </span>
                              </div>
                              <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed font-sans">
                                {log.text}
                              </p>
                            </div>
                          );
                        })
                      )}
                      <div ref={logsEndRef} />
                    </div>
                  </div>
                ) : (
                  /* Safety Report Document - Full Width Styled like Gemini */
                  <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm flex flex-col min-h-[520px]">
                    <div className="max-w-3xl mx-auto w-full">
                      {!finalReport ? (
                        <div className="h-[400px] flex flex-col items-center justify-center text-slate-400 space-y-2">
                          <FileText className="h-8 w-8 opacity-20" />
                          <p className="text-xs">Waiting for swarm Safety Auditor compliance approval...</p>
                        </div>
                      ) : (
                        <div className="text-slate-700">
                          {renderReportDocument(finalReport, activeEquipment || undefined)}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Error notifications */}
              {errorMsg && (
                <div className="flex gap-3 bg-red-950/20 border border-red-500/20 text-red-400 p-4 rounded-xl text-xs">
                  <ShieldAlert className="h-5 w-5 text-red-500 shrink-0" />
                  <div>
                    <span className="font-bold uppercase tracking-wider">Error Details:</span> {errorMsg}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: BLUEPRINTS MANAGER (KNOWLEDGE BASE EDITOR) */}
          {activeTab === "blueprints" && (
            <div className="max-w-5xl mx-auto bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
              <div className="flex justify-between items-center border-b border-slate-200 pb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <Database className="h-5 w-5 text-blue-600" />
                    <span>Enterprise Specifications Blueprint Directory</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Manage critical hardware thresholds and automated safety procedures read by the Systems Analyst Agent:
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={startNetworkScan}
                    className="flex items-center gap-1.5 text-xs font-bold bg-purple-50 border border-purple-200 text-purple-700 py-2 px-4 rounded-full hover:bg-purple-100 transition shadow-sm animate-pulse"
                  >
                    <Radio className="h-4 w-4" />
                    <span>Scan Factory Network</span>
                  </button>
                  <button
                    onClick={() => setShowAddBlueprint(!showAddBlueprint)}
                    className="flex items-center gap-1.5 text-xs font-bold bg-[#1a73e8] text-white py-2 px-4 rounded-full hover:bg-[#1557b0] transition shadow-sm"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add New Blueprint</span>
                  </button>
                </div>
              </div>

              {/* Add blueprint form */}
              {showAddBlueprint && (
                <form onSubmit={addBlueprintSpec} className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-4 animate-fade-in">
                  <div className="text-xs font-bold text-slate-800 uppercase tracking-wider">Add New Blueprint</div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-1 space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Equipment Name</label>
                      <input
                        type="text"
                        value={newBlueprintName}
                        onChange={(e) => setNewBlueprintName(e.target.value)}
                        placeholder="e.g. Mixing Vat 5"
                        required
                        className="w-full text-xs bg-white border border-slate-300 text-slate-800 rounded-lg py-1.5 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="md:col-span-2 space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Threshold Specifications (Plaintext)</label>
                      <textarea
                        value={newBlueprintSpec}
                        onChange={(e) => setNewBlueprintSpec(e.target.value)}
                        placeholder="TARGET: Mixing Vat 5&#10;CRITICAL THRESHOLD: 200C..."
                        required
                        className="w-full text-xs bg-white border border-slate-300 text-slate-800 rounded-lg py-1.5 px-3 h-20 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setShowAddBlueprint(false)}
                      className="text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 py-1.5 px-4 rounded-full transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="text-xs font-bold bg-[#1a73e8] hover:bg-[#1557b0] text-white py-1.5 px-4 rounded-full transition shadow-sm"
                    >
                      Save Blueprint
                    </button>
                  </div>
                </form>
              )}

              {/* Main Directory Layout */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                {/* Left side: list of equipment */}
                <div className="md:col-span-4 space-y-2 border-r border-slate-200 pr-6 max-h-96 overflow-y-auto">
                  {Object.keys(blueprints).map((name) => (
                    <button
                      key={name}
                      onClick={() => {
                        setSelectedBlueprint(name);
                        setBlueprintSpec(blueprints[name]);
                      }}
                      className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-semibold border transition text-left ${
                        selectedBlueprint === name
                          ? "bg-[#d3e3fd] border-[#c2e7ff] text-[#041e49]"
                          : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {getPresetIcon(name)}
                        <span>{name}</span>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Right side: details and edit */}
                <div className="md:col-span-8 flex flex-col gap-3">
                  {selectedBlueprint ? (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                          Configure Specification Profile: <span className="text-blue-600 font-extrabold">{selectedBlueprint}</span>
                        </span>
                        <button
                          onClick={deleteBlueprintSpec}
                          className="flex items-center gap-1 text-[10px] font-bold text-red-600 hover:bg-red-50 hover:border-red-200 border border-transparent py-1 px-2 rounded-full transition"
                        >
                          <Trash2 className="h-3 w-3" />
                          <span>Delete</span>
                        </button>
                      </div>

                      <textarea
                        value={blueprintSpec}
                        onChange={(e) => setBlueprintSpec(e.target.value)}
                        className="w-full text-xs font-mono border border-slate-300 bg-slate-50 rounded-xl p-4 h-64 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 leading-relaxed"
                      />

                      <div className="flex justify-end pt-2">
                        <button
                          onClick={saveBlueprintSpec}
                          className="text-xs font-bold bg-[#1a73e8] hover:bg-[#1557b0] text-white py-2 px-6 rounded-full transition shadow-sm"
                        >
                          Save Changes
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-16">
                      <Database className="h-10 w-10 text-slate-300 mb-2" />
                      <p className="text-xs">Select a blueprint from the list to view or edit specs.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: AGENT PROMPTS EDITOR */}
          {activeTab === "prompts" && (
            <div className="max-w-5xl mx-auto bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
              <div>
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2 border-b border-slate-200 pb-4">
                  <FileCode className="h-5 w-5 text-blue-600" />
                  <span>Customize Agent Behavior & System Instructions</span>
                </h3>
                <p className="text-xs text-slate-500 mt-2">
                  Tune the system prompt instructions loaded dynamically by each remote WebSocket agent before executing Groq completions:
                </p>
              </div>

              <div className="space-y-6">
                {/* Coordinator Prompts */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full">
                      1. Coordinator Prompt
                    </span>
                  </div>
                  <textarea
                    value={prompts.coordinator}
                    onChange={(e) => setPrompts({ ...prompts, coordinator: e.target.value })}
                    className="w-full text-xs font-mono border border-slate-300 bg-slate-50 rounded-xl p-3.5 h-28 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 leading-relaxed"
                  />
                </div>

                {/* Analyst Prompts */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-3 py-1 bg-yellow-50 text-yellow-800 border border-yellow-200 rounded-full">
                      2. Systems Analyst Prompt
                    </span>
                  </div>
                  <textarea
                    value={prompts.analyst}
                    onChange={(e) => setPrompts({ ...prompts, analyst: e.target.value })}
                    className="w-full text-xs font-mono border border-slate-300 bg-slate-50 rounded-xl p-3.5 h-28 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 leading-relaxed"
                  />
                </div>

                {/* Auditor Prompts */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
                      3. Safety Auditor Prompt
                    </span>
                  </div>
                  <textarea
                    value={prompts.auditor}
                    onChange={(e) => setPrompts({ ...prompts, auditor: e.target.value })}
                    className="w-full text-xs font-mono border border-slate-300 bg-slate-50 rounded-xl p-3.5 h-28 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 leading-relaxed"
                  />
                </div>

                {/* Execution Prompts */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-3 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-full">
                      4. Execution Agent Prompt
                    </span>
                  </div>
                  <textarea
                    value={prompts.execution}
                    onChange={(e) => setPrompts({ ...prompts, execution: e.target.value })}
                    className="w-full text-xs font-mono border border-slate-300 bg-slate-50 rounded-xl p-3.5 h-28 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 leading-relaxed"
                  />
                </div>

                {/* Forensic Prompts */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-3 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-full">
                      5. Forensic Investigator Prompt
                    </span>
                  </div>
                  <textarea
                    value={prompts.forensic}
                    onChange={(e) => setPrompts({ ...prompts, forensic: e.target.value })}
                    className="w-full text-xs font-mono border border-slate-300 bg-slate-50 rounded-xl p-3.5 h-28 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 leading-relaxed"
                  />
                </div>

                {/* Curator Prompts */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-3 py-1 bg-cyan-50 text-cyan-700 border border-cyan-200 rounded-full">
                      6. Knowledge Curator Prompt
                    </span>
                  </div>
                  <textarea
                    value={prompts.curator}
                    onChange={(e) => setPrompts({ ...prompts, curator: e.target.value })}
                    className="w-full text-xs font-mono border border-slate-300 bg-slate-50 rounded-xl p-3.5 h-28 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 leading-relaxed"
                  />
                </div>

                <div className="flex justify-end border-t border-slate-200 pt-4">
                  <button
                    onClick={saveAgentPrompts}
                    disabled={isSavingPrompts}
                    className="text-xs font-bold bg-[#1a73e8] hover:bg-[#1557b0] text-white py-2.5 px-8 rounded-full transition shadow-sm disabled:opacity-50"
                  >
                    {isSavingPrompts ? "Saving Rules..." : "Save Agent Instructions"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: INCIDENT HISTORY LOGS */}
          {activeTab === "history" && (
            <div className="max-w-5xl mx-auto bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
              <div>
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2 border-b border-slate-200 pb-4">
                  <History className="h-5 w-5 text-blue-600" />
                  <span>Audit Trail & Historical Telemetry Logs</span>
                </h3>
                <p className="text-xs text-slate-500 mt-2">
                  Browse and audit past swarm emergency executions saved securely in the backend logs:
                </p>
              </div>

              {history.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-slate-400 py-20">
                  <History className="h-12 w-12 text-slate-300 mb-2" />
                  <p className="text-xs">No historical records logged yet. Trigger some telemetry runs.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Table list of history */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                          <th className="pb-3 pr-4">Room/Run ID</th>
                          <th className="pb-3 pr-4">Timestamp</th>
                          <th className="pb-3 pr-4">Target System</th>
                          <th className="pb-3 pr-4">Status</th>
                          <th className="pb-3 pr-4">Latency</th>
                          <th className="pb-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {history.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50 transition">
                            <td className="py-3.5 pr-4 font-mono font-bold text-slate-600">{item.id}</td>
                            <td className="py-3.5 pr-4 text-slate-600">
                              {new Date(item.timestamp).toLocaleString()}
                            </td>
                            <td className="py-3.5 pr-4 font-semibold text-slate-800">{item.equipment}</td>
                            <td className="py-3.5 pr-4">
                              {item.status === "success" ? (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-bold">
                                  SUCCESS
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 text-[9px] font-bold">
                                  FAILED
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 pr-4 font-bold text-slate-700">{item.latency}s</td>
                            <td className="py-3.5 text-right">
                              <button
                                onClick={() => setSelectedHistoryItem(item)}
                                className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:bg-blue-50 py-1.5 px-3 rounded-full border border-blue-200 transition"
                              >
                                <Eye className="h-3 w-3" />
                                <span>Inspect Audit</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* History details Modal / Overlay */}
              {selectedHistoryItem && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                  <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col shadow-xl animate-fade-in">
                    {/* Modal header */}
                    <div className="flex justify-between items-center p-5 border-b border-slate-200 bg-slate-50">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-sm text-slate-800 font-mono">Run ID: {selectedHistoryItem.id}</span>
                        <span className="text-xs text-slate-500">
                          {new Date(selectedHistoryItem.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => window.open(`/api/history/${selectedHistoryItem.id}/export`)}
                          className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-700 hover:bg-emerald-50 py-1 px-3 rounded-full border border-emerald-200 transition"
                        >
                          <Download className="h-3.5 w-3.5" />
                          <span>Export Markdown</span>
                        </button>
                        <button
                          onClick={() => setSelectedHistoryItem(null)}
                          className="text-xs font-semibold text-slate-500 hover:text-slate-800 py-1 px-3 rounded-full hover:bg-slate-100 transition"
                        >
                          Close
                        </button>
                      </div>
                    </div>

                    {/* Modal body */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-xs space-y-1">
                          <div className="font-bold text-slate-400 uppercase text-[9px]">Target Machine</div>
                          <div className="font-bold text-slate-800 text-sm">{selectedHistoryItem.equipment}</div>
                        </div>
                        <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-xs space-y-1">
                          <div className="font-bold text-slate-400 uppercase text-[9px]">Swarm Latency</div>
                          <div className="font-bold text-slate-800 text-sm">{selectedHistoryItem.latency}s</div>
                        </div>
                        <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-xs space-y-1">
                          <div className="font-bold text-slate-400 uppercase text-[9px]">Execution Status</div>
                          <div>
                            {selectedHistoryItem.status === "success" ? (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">SUCCESS</span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 text-[10px] font-bold">FAILED</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Raw input details */}
                      <div className="space-y-1.5">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Alert Input Warning Log:</div>
                        <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-xs font-mono text-slate-700">
                          {selectedHistoryItem.alert_text}
                        </div>
                      </div>

                      {/* Event steps */}
                      <div className="space-y-2">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Swarm Conversation Logs:</div>
                        <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-200 max-h-48 overflow-y-auto font-mono text-xs">
                          {selectedHistoryItem.logs.map((log: any, idx: number) => (
                            <div key={idx} className="border-b border-slate-100 pb-2 last:border-b-0 text-slate-700">
                              <span className="font-bold text-blue-600">[{log.agent}]: </span>
                              <span>{log.text}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Audit report details */}
                      <div className="space-y-2">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Compiled Swarm Safety Report:</div>
                        <div className="bg-slate-50 border border-slate-200 p-5 rounded-xl text-xs font-sans leading-relaxed text-slate-700 whitespace-pre-wrap max-h-96 overflow-y-auto space-y-4">
                          {!selectedHistoryItem.report ? (
                            <div className="flex flex-col items-center justify-center text-slate-400 py-10">
                              <FileText className="h-8 w-8 opacity-25 mb-2" />
                              <p className="text-xs">No report generated.</p>
                            </div>
                          ) : (
                            selectedHistoryItem.report.split("\n\n").map((section: string, idx: number) => {
                              if (section.startsWith("###") || section.startsWith("##") || section.startsWith("#")) {
                                const headingText = section.replace(/^#+\s+/, "").trim();
                                return (
                                  <h4 key={idx} className="font-black text-[#0b57d0] border-b border-slate-200 pb-2 mt-5 text-xs uppercase tracking-wider">
                                    {headingText}
                                  </h4>
                                );
                              }
                              return (
                                <p key={idx} className="text-xs whitespace-pre-wrap text-slate-700 leading-relaxed">
                                  {renderMarkdownText(section)}
                                </p>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Network Scanner Modal / Overlay */}
              {showScanModal && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                  <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col shadow-xl animate-fade-in">
                    {/* Modal header */}
                    <div className="flex justify-between items-center p-5 border-b border-slate-200 bg-slate-50">
                      <div className="flex items-center gap-3">
                        <Radio className="h-5 w-5 text-purple-600 animate-pulse" />
                        <span className="font-bold text-sm text-slate-850">Active Network Scanner & Auto-Ingestion</span>
                      </div>
                      <div>
                        <button
                          onClick={() => {
                            if (!isScanningNetwork) setShowScanModal(false);
                          }}
                          disabled={isScanningNetwork}
                          className="text-xs font-semibold text-slate-500 hover:text-slate-800 py-1 px-3 rounded-full hover:bg-slate-100 transition disabled:opacity-50"
                        >
                          Close
                        </button>
                      </div>
                    </div>

                    {/* Modal body */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                      {/* Scanner Progress / Animation */}
                      <div className="flex flex-col items-center justify-center py-6 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
                        {isScanningNetwork ? (
                          <>
                            <div className="relative">
                              <div className="h-16 w-16 rounded-full border-2 border-purple-200 border-t-purple-600 animate-spin"></div>
                              <Radio className="absolute inset-0 m-auto h-6 w-6 text-purple-600 animate-ping" />
                            </div>
                            <div className="text-center space-y-1">
                              <div className="text-sm font-bold text-slate-800">Scanning Factory Network...</div>
                              <div className="text-xs text-purple-700 animate-pulse">Querying SNMP, Modbus, and OPC UA agents</div>
                            </div>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-16 w-16 text-emerald-600" />
                            <div className="text-center space-y-1">
                              <div className="text-sm font-bold text-slate-800">Network Scan Completed!</div>
                              <div className="text-xs text-emerald-700 font-semibold">Successfully scanned and updated equipment directory.</div>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Live scanning logs */}
                      <div className="space-y-2">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Scan Event Logs:</div>
                        <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-xs font-mono text-slate-700 max-h-48 overflow-y-auto space-y-1.5">
                          {scanLogs.length === 0 ? (
                            <div className="text-slate-400 italic">Initializing scanner...</div>
                          ) : (
                            scanLogs.map((log, idx) => (
                              <div key={idx} className="flex gap-2">
                                <span className="text-purple-700 font-bold font-sans">[{log.agent}]:</span>
                                <span>{log.text}</span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Discovered devices results table */}
                      {scanResults.length > 0 && (
                        <div className="space-y-2 animate-fade-in">
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Discovered Network Assets ({scanResults.length}):</div>
                          <div className="overflow-hidden border border-slate-200 rounded-xl bg-slate-50">
                            <table className="w-full text-left text-xs">
                              <thead>
                                <tr className="border-b border-slate-200 bg-slate-100 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                                  <th className="py-2.5 px-4">IP Address</th>
                                  <th className="py-2.5 px-4">Equipment / Model</th>
                                  <th className="py-2.5 px-4">Status</th>
                                  <th className="py-2.5 px-4">Ingestion Source / Details</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 text-slate-700 font-mono">
                                {scanResults.map((res, idx) => (
                                  <tr key={idx} className="hover:bg-slate-100/50 transition">
                                    <td className="py-2.5 px-4 text-purple-700 font-bold">{res.ip}</td>
                                    <td className="py-2.5 px-4 font-sans font-bold text-slate-800">{res.name}</td>
                                    <td className="py-2.5 px-4">
                                      {res.status === "Ingested" && (
                                        <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-bold">INGESTED</span>
                                      )}
                                      {res.status === "Already Active" && (
                                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">ACTIVE</span>
                                      )}
                                      {res.status === "Failed" && (
                                        <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 text-[10px] font-bold">FAILED</span>
                                      )}
                                    </td>
                                    <td className="py-2.5 px-4 font-sans text-xs text-slate-500">{res.details}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
