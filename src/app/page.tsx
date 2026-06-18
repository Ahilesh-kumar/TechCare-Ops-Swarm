"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
  Shield,
  Search,
  Brain,
  Loader2,
} from "lucide-react";

interface SwarmLog {
  agent: string;
  text: string;
}

interface SwarmReportSections {
  safety: string;
  execution: string;
  detective: string;
  knowledge: string;
}

const parseSwarmReport = (reportText: string): SwarmReportSections => {
  const sections: SwarmReportSections = {
    safety: "",
    execution: "",
    detective: "",
    knowledge: ""
  };

  if (!reportText) return sections;

  if (!reportText.includes("---") && !reportText.includes("Execution Log") && !reportText.includes("Root Cause Analysis")) {
    sections.safety = reportText;
    return sections;
  }

  const parts = reportText.split(/\n\s*---\s*\n/);
  
  parts.forEach((part) => {
    const trimmed = part.trim();
    if (!trimmed) return;

    if (trimmed.includes("Incident Summary") || trimmed.includes("Mitigation Report") || trimmed.includes("EXECUTIVE SUMMARY")) {
      sections.safety = trimmed.replace(/^#+\s*.*Incident Summary\s*/i, "").trim();
    } else if (trimmed.includes("Execution Log") || trimmed.includes("ACTUATOR_EXECUTION_LOG")) {
      let content = trimmed.replace(/^#+\s*.*Execution Log.*\s*/i, "").trim();
      if (content.startsWith("```")) {
        content = content.replace(/^```[a-z]*\n/i, "");
      }
      if (content.endsWith("```")) {
        content = content.slice(0, -3).trim();
      }
      sections.execution = content;
    } else if (trimmed.includes("Root Cause Analysis") || trimmed.includes("Forensic Report") || trimmed.includes("INCIDENT TIMELINE")) {
      sections.detective = trimmed.replace(/^#+\s*.*Forensic Report.*\s*/i, "").trim();
    } else if (trimmed.includes("Knowledge Curator") || trimmed.includes("LEARNING OUTCOME") || trimmed.includes("Updated Specification")) {
      sections.knowledge = trimmed.replace(/^#+\s*.*Self-Learning Update.*\s*/i, "").trim();
    } else {
      if (!sections.safety) {
        sections.safety = trimmed;
      }
    }
  });

  return sections;
};

export default function Home() {
  const [activeTab, setActiveTab] = useState("control");
  const [reportFontSize, setReportFontSize] = useState<"sm" | "base" | "lg">("base");
  const [activeReportSubTab, setActiveReportSubTab] = useState<"safety" | "execution" | "detective" | "knowledge">("safety");
  const [activeHistoryReportSubTab, setActiveHistoryReportSubTab] = useState<"safety" | "execution" | "detective" | "knowledge">("safety");
  const [alertInput, setAlertInput] = useState("");
  const [swarmLogs, setSwarmLogs] = useState<SwarmLog[]>([]);
  const [finalReport, setFinalReport] = useState("");
  const [safetyReport, setSafetyReport] = useState("");
  const [executionReport, setExecutionReport] = useState("");
  const [detectiveReport, setDetectiveReport] = useState("");
  const [knowledgeReport, setKnowledgeReport] = useState("");
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

  const parsedReport = useMemo(() => {
    if (isRunning) {
      return {
        safety: safetyReport,
        execution: executionReport,
        detective: detectiveReport,
        knowledge: knowledgeReport,
      };
    }
    return parseSwarmReport(finalReport);
  }, [isRunning, finalReport, safetyReport, executionReport, detectiveReport, knowledgeReport]);

  const parsedHistoryReport = useMemo(() => {
    return selectedHistoryItem ? parseSwarmReport(selectedHistoryItem.report) : null;
  }, [selectedHistoryItem]);

  const logsEndRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Helper to parse markdown inline styles: **bold** and *italic*
  const renderMarkdownText = (text: string): React.ReactNode => {
    if (!text) return null;
    // Split on ** first, then handle * for italic
    const boldParts = text.split(/\*\*/);
    return boldParts.map((boldPart, bi) => {
      if (bi % 2 === 1) {
        // Inside ** ... ** — render as bold, strip any stray * chars
        return (
          <strong key={`b${bi}`} className="font-bold text-slate-800">
            {boldPart.replace(/\*/g, "")}
          </strong>
        );
      }
      // Outside bold: split on single * for italic
      const italicParts = boldPart.split(/\*/);
      return italicParts.map((part, ii) => (
        ii % 2 === 1
          ? <em key={`i${bi}-${ii}`} className="italic text-slate-600">{part}</em>
          : <span key={`t${bi}-${ii}`}>{part}</span>
      ));
    });
  };

  // Normalize raw report text: handles double-escaped \n and Python-dict-like strings
  const normalizeReportText = (text: string): string => {
    if (!text) return text;
    // Fix double-escaped newlines from JSON serialization
    let normalized = text.replace(/\\n/g, "\n").replace(/\\t/g, "  ");
    // Detect Python-dict-like format: {'KEY': 'value', ...}
    const stripped = normalized.trim();
    if (stripped.startsWith("{") && stripped.endsWith("}") && /['"][A-Z][A-Z &\-:]+['"]/.test(stripped)) {
      const pairs: [string, string][] = [];
      const pairRegex = /['"]([A-Z][A-Z &\-:/]+)['"]\s*:\s*['"]([^'"]*)['"]/g;
      let m: RegExpExecArray | null;
      while ((m = pairRegex.exec(stripped)) !== null) {
        pairs.push([m[1].trim(), m[2].replace(/\\n/g, "\n").trim()]);
      }
      if (pairs.length > 0) {
        return pairs.map(([k, v]) => `**${k.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}:**\n${v}`).join("\n\n");
      }
    }
    return normalized;
  };

  const formatHeading = (heading: string): string => {
    const clean = heading.replace(/:/g, "").trim().toUpperCase();
    if (clean === "EXECUTIVE SUMMARY") return "Executive Summary";
    if (clean === "IMPORTANT STEPS HIGHLIGHTED" || clean === "KEY INTERVENTION STEPS") return "Key Intervention Steps";
    if (clean === "STEP-BY-STEP ACTION REQUIRED" || clean === "STEP-BY-STEP ACTION") return "Step-by-step Action Required";
    if (clean === "SAFETY PRECAUTIONS") return "Safety Precautions";
    if (clean === "CONCLUSION" || clean === "CONCLUSION & COMPLIANCE") return "Conclusion & Compliance";
    if (clean === "COMPLIANCE SIGN-OFF") return "Compliance Sign-off";
    return clean.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  };

  // Gemini-style document renderer for the Safety Incident Report
  const renderReportDocument = (reportText: string, equipmentName?: string) => {
    if (!reportText) return null;
    const text = normalizeReportText(reportText);

    const sizeMap = {
      sm:   { title: "text-base font-bold text-slate-900", heading: "text-sm font-bold text-slate-850 mt-5 mb-1.5", para: "text-[11px] text-slate-700 leading-relaxed mb-3", bullet: "text-[11px] text-slate-700 leading-relaxed", divider: "my-3" },
      base: { title: "text-lg font-bold text-slate-900", heading: "text-sm font-bold text-slate-850 mt-6 mb-2",   para: "text-xs text-slate-700 leading-relaxed mb-3",    bullet: "text-xs text-slate-700 leading-relaxed",    divider: "my-4" },
      lg:   { title: "text-xl font-bold text-slate-900", heading: "text-base font-bold text-slate-850 mt-7 mb-3", para: "text-sm text-slate-700 leading-relaxed mb-4",    bullet: "text-sm text-slate-700 leading-relaxed",    divider: "my-5" },
    };
    const sz = sizeMap[reportFontSize] || sizeMap.base;

    const reportTitle = equipmentName
      ? `Incident Report: ${equipmentName} Mitigation`
      : selectedBlueprint
      ? `Incident Report: ${selectedBlueprint} Mitigation`
      : "Incident Report: Swarm Safety Mitigation";

    const lines = text.split("\n");
    const elements: React.ReactNode[] = [];
    let listBuf: { prefix: string; content: string; num: boolean }[] = [];

    const flushList = (key: string) => {
      if (!listBuf.length) return;
      elements.push(
        <ul key={`ul-${key}`} className="space-y-2 my-2 pl-1">
          {listBuf.map((item, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span className={`shrink-0 mt-0.5 ${item.num ? "text-[10px] w-4 text-right font-semibold text-slate-400" : "text-slate-350 text-xs leading-none"}`}>
                {item.num ? item.prefix : "○"}
              </span>
              <span className={sz.bullet}>{renderMarkdownText(item.content)}</span>
            </li>
          ))}
        </ul>
      );
      listBuf = [];
    };

    lines.forEach((rawLine, idx) => {
      const line = rawLine.trim();
      if (!line) { flushList(`e${idx}`); return; }

      if (/^---+$/.test(line)) { flushList(`d${idx}`); elements.push(<hr key={`hr${idx}`} className={`border-slate-200 ${sz.divider}`} />); return; }
      if (/^#{1,6}\s/.test(line) && line.replace(/^#+\s*/, "").length < 3) return;

      const headingLine = line.replace(/^[-*•○◦■\s]+/, "");
      const sectionMatch = headingLine.match(/^\*\*([^*]+?):\*\*(.*)$/) || headingLine.match(/^([A-Z][A-Z ,&'\-/]{2,}):\s*(.*)$/);
      if (sectionMatch) {
        flushList(`s${idx}`);
        const label = sectionMatch[1].trim();
        const rest  = (sectionMatch[2] || "").trim();
        const isSection = /^[A-Z0-9 &'\-/:]+$/.test(label) || headingLine.startsWith("**");
        if (isSection) {
          elements.push(
            <div key={`sec${idx}`}>
              <h3 className={sz.heading}>{formatHeading(label)}</h3>
              {rest && <p className={sz.para}>{renderMarkdownText(rest)}</p>}
            </div>
          );
          return;
        }
      }

      if (/^#{1,3}\s/.test(line)) {
        flushList(`h${idx}`);
        const label = line.replace(/^#+\s*/, "").replace(/:$/, "").trim();
        elements.push(<h3 key={`mh${idx}`} className={sz.heading}>{formatHeading(label)}</h3>);
        return;
      }

      const bulletMatch = line.match(/^[-*•○◦■]\s+(.+)/);
      const numMatch    = line.match(/^(\d+)\.\s+(.+)/);
      if (bulletMatch) { listBuf.push({ prefix: "○", content: bulletMatch[1], num: false }); return; }
      if (numMatch)    { listBuf.push({ prefix: numMatch[1] + ".", content: numMatch[2], num: true }); return; }

      flushList(`p${idx}`);
      elements.push(<p key={`p${idx}`} className={sz.para}>{renderMarkdownText(line)}</p>);
    });
    flushList("end");

    return (
      <div className="text-left">
        <h2 className={`${sz.title} mb-4 pb-4 border-b border-slate-200`}>{reportTitle}</h2>
        <div className="space-y-0.5">{elements}</div>
      </div>
    );
  };

  // Rich text renderer for Forensic, Knowledge, Execution panels
  const renderRichPanel = (text: string) => {
    if (!text) return null;
    const normalized = normalizeReportText(text);
    const lines = normalized.split("\n");
    const elements: React.ReactNode[] = [];
    let listBuf: { prefix: string; content: string; num: boolean }[] = [];
    let inCodeBlock = false;
    let codeLines: string[] = [];

    const flushList = (key: string) => {
      if (!listBuf.length) return;
      elements.push(
        <ul key={`ul-${key}`} className="space-y-1.5 my-2 pl-1">
          {listBuf.map((item, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className={`shrink-0 mt-0.5 ${item.num ? "text-[9px] w-4 text-right font-semibold text-slate-400" : "text-slate-350 text-xs leading-none"}`}>
                {item.num ? item.prefix : "◦"}
              </span>
              <span className="text-[11px] text-slate-700 leading-relaxed">{renderMarkdownText(item.content)}</span>
            </li>
          ))}
        </ul>
      );
      listBuf = [];
    };

    const flushCode = (key: string) => {
      if (!codeLines.length) return;
      elements.push(
        <pre key={`code-${key}`} className="bg-slate-900 text-emerald-400 font-mono text-[10px] p-3 rounded-lg border border-slate-800 leading-relaxed overflow-x-auto my-2 whitespace-pre-wrap">
          {codeLines.join("\n")}
        </pre>
      );
      codeLines = [];
      inCodeBlock = false;
    };

    lines.forEach((rawLine, idx) => {
      const line = rawLine;
      const trimmed = line.trim();

      if (trimmed.startsWith("```")) {
        if (inCodeBlock) { flushCode(`c${idx}`); } else { flushList(`bc${idx}`); inCodeBlock = true; }
        return;
      }
      if (inCodeBlock) { codeLines.push(line); return; }

      if (!trimmed) { flushList(`e${idx}`); return; }
      if (/^---+$/.test(trimmed)) { flushList(`d${idx}`); elements.push(<hr key={`hr${idx}`} className="border-slate-100 my-2" />); return; }

      const headingLine = trimmed.replace(/^[-*•○◦■\s]+/, "");
      const secMatch = headingLine.match(/^\*\*([^*]+?):\*\*(.*)$/);
      const h3Match  = /^#{1,3}\s/.test(trimmed);
      if (secMatch) {
        flushList(`s${idx}`);
        const label = secMatch[1].trim();
        const rest  = (secMatch[2] || "").trim();
        elements.push(
          <div key={`sec${idx}`} className="mt-3 mb-1">
            <h4 className="text-[11px] font-bold text-slate-900 font-sans tracking-tight">
              {formatHeading(label)}
            </h4>
            {rest && <p className="text-[11px] text-slate-650 leading-relaxed mt-0.5">{renderMarkdownText(rest)}</p>}
          </div>
        );
        return;
      }
      if (h3Match) {
        flushList(`h${idx}`);
        const label = trimmed.replace(/^#+\s*/, "").replace(/:$/, "").trim();
        elements.push(<h4 key={`h${idx}`} className="text-[11px] font-bold text-slate-900 font-sans tracking-tight mt-3 mb-1">{formatHeading(label)}</h4>);
        return;
      }

      if (/^\*\*\[.*\]\*\*|^Step \d+:|^\[ACTUATOR/.test(trimmed)) {
        flushList(`al${idx}`);
        elements.push(<p key={`al${idx}`} className="text-[11px] font-mono text-emerald-400 bg-slate-900 px-2 py-0.5 rounded my-0.5">{trimmed.replace(/\*\*/g, "")}</p>);
        return;
      }

      const bulletMatch = trimmed.match(/^[-*•○◦■]\s+(.+)/);
      const numMatch    = trimmed.match(/^(\d+)\.\s+(.+)/);
      if (bulletMatch) { listBuf.push({ prefix: "◦", content: bulletMatch[1], num: false }); return; }
      if (numMatch)    { listBuf.push({ prefix: numMatch[1] + ".", content: numMatch[2], num: true }); return; }

      flushList(`p${idx}`);
      elements.push(<p key={`p${idx}`} className="text-[11px] text-slate-600 leading-relaxed mb-1">{renderMarkdownText(trimmed)}</p>);
    });
    flushList("end");
    flushCode("end");

    return <div className="space-y-0">{elements}</div>;
  };

  const renderExecutionLogs = (executionText: string) => {
    if (!executionText) return null;
    return (
      <div className="space-y-1">
        {executionText.split("\n").filter(Boolean).map((line, i) => {
          const isStep = /^\*\*\[|^\[ACTUATOR|^Step \d+:|^--/.test(line.trim());
          const isSuc  = /SUCCESS|CONFIRMED|COMPLETE/.test(line);
          const isFail = /FAIL|ERROR|REJECT/.test(line);
          return (
            <div key={i} className={`font-mono text-[10px] leading-relaxed px-3 py-0.5 rounded ${
              isSuc  ? "text-emerald-400 bg-slate-900" :
              isFail ? "text-red-400 bg-slate-900" :
              isStep ? "text-cyan-300 bg-slate-900 font-bold" :
              "text-slate-300 bg-slate-900"
            }`}>
              {line.replace(/\*\*/g, "")}
            </div>
          );
        })}
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
      } else {
        console.error("Failed to fetch blueprints:", bpRes.status, bpRes.statusText);
      }

      // 2. Fetch Prompts
      const prRes = await fetch("/api/prompts");
      if (prRes.ok) {
        const prData = await prRes.json();
        setPrompts(prData);
      } else {
        console.error("Failed to fetch prompts:", prRes.status, prRes.statusText);
      }

      // 3. Fetch History
      const hiRes = await fetch("/api/history");
      if (hiRes.ok) {
        const hiData = await hiRes.json();
        setHistory(hiData);
      } else {
        console.error("Failed to fetch history:", hiRes.status, hiRes.statusText);
      }

      // 4. Fetch Metrics
      const mtRes = await fetch("/api/metrics");
      if (mtRes.ok) {
        const mtData = await mtRes.json();
        setMetrics(mtData);
      } else {
        console.error("Failed to fetch metrics:", mtRes.status, mtRes.statusText);
      }

      // 5. Fetch Equipment Health Status
      const eqRes = await fetch("/api/equipment");
      if (eqRes.ok) {
        const eqData = await eqRes.json();
        setEquipmentStatus(eqData);
      } else {
        console.error("Failed to fetch equipment health:", eqRes.status, eqRes.statusText);
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
    setSafetyReport("");
    setExecutionReport("");
    setDetectiveReport("");
    setKnowledgeReport("");
    setActiveEquipment("");
    setErrorMsg("");
    setElapsedTime(0);
    setResultsView("console");

    try {
      const isLive = networkMode === "Live Band.ai Network";
      const isMockInstant = networkMode === "Offline Mock (Instant)";
      const response = await fetch("/api/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alert_text: textToProcess,
          delay: isMockInstant ? 0 : stepDelay,
          live_mode: isLive,
          mock_mode: isMockInstant,
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
              } else if (eventData.type === "report_part") {
                if (eventData.part === "safety") {
                  setSafetyReport(eventData.content);
                  setResultsView("report");
                } else if (eventData.part === "execution") {
                  setExecutionReport(eventData.content);
                } else if (eventData.part === "detective") {
                  setDetectiveReport(eventData.content);
                } else if (eventData.part === "knowledge") {
                  setKnowledgeReport(eventData.content);
                }
              } else if (eventData.type === "report") {
                setFinalReport(eventData.report);
                const parsed = parseSwarmReport(eventData.report);
                setSafetyReport(parsed.safety);
                setExecutionReport(parsed.execution);
                setDetectiveReport(parsed.detective);
                setKnowledgeReport(parsed.knowledge);
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

  // Shared PDF generator — auto-downloads without print dialog
  const generatePDF = async (reportText: string, equipment: string, timestamp?: string) => {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentW = pageW - margin * 2;
    let y = 0;

    // ── Colours ──────────────────────────────────────────────
    const BLUE    = [11,  87, 208] as const;
    const DARK    = [15,  23,  42] as const;
    const BODY    = [51,  65,  85] as const;
    const MUTED   = [100, 116, 139] as const;
    const LIGHT   = [241, 245, 249] as const;
    const WHITE   = [255, 255, 255] as const;
    const DIVIDER = [226, 232, 240] as const;

    const setFill = ([r,g,b]: readonly number[]) => doc.setFillColor(r,g,b);
    const setDraw = ([r,g,b]: readonly number[]) => doc.setDrawColor(r,g,b);
    const setTxt  = ([r,g,b]: readonly number[]) => doc.setTextColor(r,g,b);

    const addPage = () => { doc.addPage(); y = margin + 6; };
    const checkY  = (h: number) => { if (y + h > pageH - 18) addPage(); };

    interface Segment {
      text: string;
      isBold: boolean;
    }

    const parseTokens = (txt: string) => {
      const parts = txt.split(/\*\*([^*]+?)\*\?/g);
      return parts.map((part, index) => ({
        text: part,
        isBold: index % 2 === 1
      })).filter(t => t.text !== "");
    };

    const writeWrappedInlineText = (
      text: string,
      startX: number,
      width: number,
      lineHeight: number,
      prefixInfo?: { type: "bullet" | "number"; numStr?: string }
    ) => {
      const tokens = parseTokens(text);
      const segments: Segment[] = [];
      tokens.forEach(tok => {
        const chunks = tok.text.split(/(\s+)/).filter(Boolean);
        chunks.forEach(chunk => {
          segments.push({ text: chunk, isBold: tok.isBold });
        });
      });

      let currentLine: Segment[] = [];
      let currentW = 0;
      let isFirstLine = true;

      const flushCurrentLine = () => {
        if (currentLine.length === 0) return;
        checkY(lineHeight);

        if (isFirstLine && prefixInfo) {
          if (prefixInfo.type === "bullet") {
            setFill(MUTED);
            doc.circle(margin + 3.5, y - 1.2, 0.7, "F");
          } else if (prefixInfo.type === "number" && prefixInfo.numStr) {
            doc.setFont("helvetica", "bold");
            setTxt(MUTED);
            doc.text(prefixInfo.numStr, margin + 3, y);
            doc.setFont("helvetica", "normal");
          }
          isFirstLine = false;
        }

        let runX = startX;
        currentLine.forEach(seg => {
          doc.setFont("helvetica", seg.isBold ? "bold" : "normal");
          doc.setFontSize(9);
          setTxt(BODY);
          doc.text(seg.text, runX, y);
          runX += doc.getTextWidth(seg.text);
        });
        y += lineHeight;
        currentLine = [];
        currentW = 0;
      };

      segments.forEach(seg => {
        doc.setFont("helvetica", seg.isBold ? "bold" : "normal");
        doc.setFontSize(9);
        const segW = doc.getTextWidth(seg.text);
        const isSpace = /^\s+$/.test(seg.text);

        if (isSpace) {
          if (currentLine.length > 0) {
            if (currentW + segW <= width) {
              currentLine.push(seg);
              currentW += segW;
            } else {
              flushCurrentLine();
            }
          }
        } else {
          if (currentW + segW <= width) {
            currentLine.push(seg);
            currentW += segW;
          } else {
            if (currentLine.length === 0) {
              currentLine.push(seg);
              currentW += segW;
              flushCurrentLine();
            } else {
              flushCurrentLine();
              currentLine.push(seg);
              currentW = segW;
            }
          }
        }
      });

      flushCurrentLine();
    };

    // ── COVER HEADER ─────────────────────────────────────────
    setFill(DARK); doc.rect(0, 0, pageW, 36, "F");
    setFill(BLUE); doc.rect(0, 36, pageW, 3, "F");
    // Logo dot
    setFill(BLUE);  doc.circle(margin, 13, 3.5, "F");
    setFill(WHITE); doc.circle(margin, 13, 1.6, "F");
    // Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    setTxt(WHITE);
    doc.text("TechCare Swarm", margin + 7, 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    setTxt([180, 200, 240]);
    doc.text("AI-Powered Industrial Incident Report", margin + 7, 18.5);
    // Right-side timestamp
    doc.setFontSize(7.5);
    setTxt([148, 163, 184]);
    const ts = timestamp || new Date().toLocaleString();
    doc.text(ts, pageW - margin, 12, { align: "right" });
    doc.text("Confidential - Internal Use Only", pageW - margin, 18.5, { align: "right" });

    y = 46;

    // ── EQUIPMENT SUMMARY STRIP ───────────────────────────────
    setFill(LIGHT);
    doc.roundedRect(margin, y, contentW, 14, 2, 2, "F");
    setFill(BLUE);
    doc.roundedRect(margin, y, 4, 14, 1, 1, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    setTxt(DARK);
    doc.text(`Incident Report: ${equipment} Mitigation`, margin + 8, y + 6.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    setTxt(MUTED);
    doc.text("Generated by TechCare Swarm Autonomous Agent Cluster", margin + 8, y + 11.5);
    y += 22;

    // ── REPORT BODY ───────────────────────────────────────────
    const lines = reportText.replace(/\\n/g, "\n").split("\n");
    let inSection = false;
    let hasComplianceSignOff = false;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) { y += inSection ? 2 : 3; continue; }

      // Horizontal rule
      if (/^---+$/.test(line)) {
        checkY(5);
        setDraw(DIVIDER);
        doc.setLineWidth(0.3);
        doc.line(margin, y, pageW - margin, y);
        y += 5; continue;
      }

      // Section heading detection
      const secM  = line.match(/^\*\*([^*]+?)\*\*:?\s*(.*)$/) || line.match(/^([A-Z][A-Z ,&'\-/]{2,}):\s*(.*)$/);
      const isH3  = /^#{1,3}\s/.test(line);
      const isSec = secM && /^[A-Z0-9 &'\-/:]+$/.test((secM[1] || "").trim());

      if (isSec || isH3) {
        checkY(14);
        const rawLabel = isSec ? secM![1].trim().replace(/:/g, "") : line.replace(/^#+\s*/, "").replace(/:$/, "").trim();
        const rest     = isSec ? (secM![2] || "").trim() : "";
        const label = formatHeading(rawLabel);
        
        if (label === "Compliance Sign-off") {
          hasComplianceSignOff = true;
        }

        // Section card background + left bar
        setFill(LIGHT);
        doc.roundedRect(margin, y - 1, contentW, 9, 1.5, 1.5, "F");
        setFill(BLUE);
        doc.roundedRect(margin, y - 1, 3, 9, 1, 1, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        setTxt(BLUE);
        doc.text(label, margin + 6, y + 5.2);
        inSection = true;
        y += 11;

        if (rest) {
          writeWrappedInlineText(rest, margin + 4, contentW - 4, 4.8);
          y += 1;
        }
        continue;
      }

      // Bullet items — draw circle manually to avoid Unicode encoding bugs
      const bulletMatch = line.match(/^[-*•○◦■]\s+(.+)/);
      const numMatch    = line.match(/^(\d+)\.\s+(.+)/);
      if (bulletMatch || numMatch) {
        const content = bulletMatch ? bulletMatch[1] : numMatch![2];
        if (numMatch) {
          writeWrappedInlineText(content, margin + 8, contentW - 10, 4.8, { type: "number", numStr: `${numMatch[1]}.` });
        } else {
          writeWrappedInlineText(content, margin + 8, contentW - 10, 4.8, { type: "bullet" });
        }
        y += 1.5;
        continue;
      }

      // Plain paragraph
      writeWrappedInlineText(line, margin + 4, contentW - 4, 5);
      y += 1;
    }

    if (hasComplianceSignOff) {
      checkY(35);
      y += 10;
      
      setDraw(MUTED);
      doc.setLineWidth(0.3);
      doc.setLineDashPattern([1, 2], 0);
      
      const col1X = margin + 5;
      const colWidth = (contentW - 20) / 2;
      doc.line(col1X, y + 15, col1X + colWidth, y + 15);
      
      const col2X = pageW - margin - 5 - colWidth;
      doc.line(col2X, y + 15, col2X + colWidth, y + 15);
      
      doc.setLineDashPattern([], 0);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      setTxt(DARK);
      doc.text("Operations Coordinator Signature", col1X, y + 19.5);
      doc.text("Safety Officer Signature", col2X, y + 19.5);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      setTxt(MUTED);
      doc.text("Date: ________________________", col1X, y + 24);
      doc.text("Date: ________________________", col2X, y + 24);
      
      y += 30;
    }

    // ── FOOTER BAR on every page ──────────────────────────────
    const totalPages = (doc as any).getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      setFill(DARK);
      doc.rect(0, pageH - 12, pageW, 12, "F");
      setFill(BLUE);
      doc.rect(0, pageH - 12, pageW, 1, "F");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      setTxt([148, 163, 184]);
      doc.text("TechCare Swarm  |  Powered by Groq Llama & Band SDK", margin, pageH - 6);
      doc.text(`Page ${p} of ${totalPages}`, pageW - margin, pageH - 6, { align: "right" });
    }

    const filename = `TechCare_${equipment.replace(/\s+/g, "_")}_Incident_Report.pdf`;
    doc.save(filename);
  };

  const downloadReport = () => {
    const equipment = activeEquipment || selectedBlueprint || "Equipment";
    generatePDF(finalReport, equipment);
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

          <hr className="border-slate-200 mt-2" />
        </div>

        {/* Footer Info */}
        <div className="text-[10px] text-slate-500 space-y-1 mt-6 border-t border-slate-200 pt-4">
          <div className="font-semibold text-slate-700">TechCare Swarm Engine</div>
          <div>Inference: Llama-3.3-70B on Groq</div>
          <div>Protocols: Band SDK WebSockets</div>
          <button
            onClick={resetSandbox}
            className="w-full mt-3.5 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-[9px] uppercase tracking-wider transition shadow-sm"
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
                        <option>Offline Mock (Instant)</option>
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
                        title="Download Report as PDF"
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
                    <div className="flex justify-between items-center mb-3 shrink-0">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        Swarm Real-Time Audit Console
                      </h3>
                      <div className="flex items-center gap-1.5 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                        <button
                          onClick={() => setReportFontSize("sm")}
                          className={`px-2 py-0.5 text-[10px] font-bold rounded ${reportFontSize === "sm" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
                          title="Small Text"
                        >
                          A-
                        </button>
                        <button
                          onClick={() => setReportFontSize("base")}
                          className={`px-2 py-0.5 text-[10px] font-bold rounded ${reportFontSize === "base" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
                          title="Normal Text"
                        >
                          A
                        </button>
                        <button
                          onClick={() => setReportFontSize("lg")}
                          className={`px-2 py-0.5 text-[10px] font-bold rounded ${reportFontSize === "lg" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
                          title="Large Text"
                        >
                          A+
                        </button>
                      </div>
                    </div>
                    <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-5 overflow-y-auto space-y-3.5 font-mono">
                      {swarmLogs.length === 0 ? (
                        isRunning ? (
                          <div className="h-full flex flex-col items-center justify-center text-[#0b57d0] space-y-2">
                            <Loader2 className="h-8 w-8 animate-spin opacity-80" />
                            <p className="text-xs font-semibold animate-pulse">Swarm is active. Awaiting real-time telemetry log feed...</p>
                          </div>
                        ) : (
                          <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2">
                            <Terminal className="h-8 w-8 opacity-20" />
                            <p className="text-xs">Swarm is idle. Telemetry log stream will load here.</p>
                          </div>
                        )
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
                              <p className={`text-slate-700 whitespace-pre-wrap leading-relaxed font-sans ${
                                reportFontSize === "sm" ? "text-[10px]" : reportFontSize === "lg" ? "text-sm" : "text-xs"
                              }`}>
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
                    <div className="flex justify-between items-center border-b border-slate-150 pb-3 mb-5 shrink-0">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        Approved Mitigation Report
                      </h3>
                      <div className="flex items-center gap-1.5 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                        <button
                          onClick={() => setReportFontSize("sm")}
                          className={`px-2 py-0.5 text-[10px] font-bold rounded ${reportFontSize === "sm" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
                          title="Small Text"
                        >
                          A-
                        </button>
                        <button
                          onClick={() => setReportFontSize("base")}
                          className={`px-2 py-0.5 text-[10px] font-bold rounded ${reportFontSize === "base" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
                          title="Normal Text"
                        >
                          A
                        </button>
                        <button
                          onClick={() => setReportFontSize("lg")}
                          className={`px-2 py-0.5 text-[10px] font-bold rounded ${reportFontSize === "lg" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
                          title="Large Text"
                        >
                          A+
                        </button>
                      </div>
                    </div>
                    <div className="max-w-7xl mx-auto w-full flex-1">
                      {!safetyReport ? (
                        <div className="h-[400px] flex flex-col items-center justify-center text-slate-400 space-y-2 bg-white border border-slate-200 rounded-2xl shadow-sm">
                          <FileText className="h-8 w-8 opacity-20" />
                          <p className="text-xs">Waiting for swarm Safety Auditor compliance approval...</p>
                        </div>
                      ) : (
                        <div className="text-slate-700 h-full">
                          {(!finalReport.includes("---") && !isRunning) ? (
                            <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm max-w-3xl mx-auto">
                              <div className="flex items-center gap-2 pb-3 border-b border-slate-100 mb-4">
                                <Shield className="h-4.5 w-4.5 text-[#0b57d0]" />
                                <h3 className="font-bold text-sm text-slate-800">Safety Incident Report</h3>
                              </div>
                              {renderReportDocument(finalReport, activeEquipment || undefined)}
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                              {/* Left Column: Safety Incident Report (Span 7) */}
                              <div className="lg:col-span-7 bg-white border border-slate-200 p-6 rounded-2xl shadow-sm flex flex-col h-full min-h-[500px]">
                                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                                  <div className="flex items-center gap-2">
                                    <Shield className="h-4.5 w-4.5 text-[#0b57d0]" />
                                    <h3 className="font-bold text-sm text-slate-800">Safety Incident Report</h3>
                                  </div>
                                  <span className="text-[10px] bg-blue-50 text-[#0b57d0] px-2 py-0.5 rounded-full font-bold">Approved Plan</span>
                                </div>
                                <div className="flex-1 overflow-y-auto">
                                  {renderReportDocument(parsedReport.safety || finalReport, activeEquipment || undefined)}
                                </div>
                              </div>

                              {/* Right Column: Automated Swarm Containment & RCA Results (Span 5) */}
                              <div className="lg:col-span-5 flex flex-col gap-4">
                                {/* Execution Logs Block */}
                                <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm flex flex-col min-h-[160px]">
                                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-3">
                                    <div className="flex items-center gap-2">
                                      <Activity className="h-4.5 w-4.5 text-purple-600" />
                                      <h3 className="font-bold text-xs text-slate-800">Swarm Actuator Execution Logs</h3>
                                    </div>
                                    {parsedReport.execution ? (
                                      <span className="text-[10px] bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full font-bold">SUCCESS</span>
                                    ) : isRunning ? (
                                      <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold animate-pulse">RUNNING</span>
                                    ) : (
                                      <span className="text-[10px] bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full font-bold">WAITING</span>
                                    )}
                                  </div>
                                  <div className="flex-1 overflow-y-auto max-h-[220px]">
                                    {parsedReport.execution ? (
                                      renderExecutionLogs(parsedReport.execution)
                                    ) : (
                                      <div className="flex flex-col items-center justify-center h-full text-slate-400 py-6">
                                        <Activity className="h-6 w-6 animate-pulse opacity-45 mb-2" />
                                        <p className="text-[10px]">Simulating actuator containment steps...</p>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Detective Report Block */}
                                <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm flex flex-col min-h-[160px]">
                                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-3">
                                    <div className="flex items-center gap-2">
                                      <Search className="h-4.5 w-4.5 text-rose-600" />
                                      <h3 className="font-bold text-xs text-slate-800">Forensic Investigation & RCA</h3>
                                    </div>
                                    {parsedReport.detective ? (
                                      <span className="text-[10px] bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full font-bold">COMPLETE</span>
                                    ) : isRunning ? (
                                      <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold animate-pulse">WAITING</span>
                                    ) : (
                                      <span className="text-[10px] bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full font-bold">WAITING</span>
                                    )}
                                  </div>
                                  <div className="flex-1 overflow-y-auto max-h-[220px]">
                                    {parsedReport.detective ? (
                                      renderRichPanel(parsedReport.detective)
                                    ) : (
                                      <div className="flex flex-col items-center justify-center h-full text-slate-400 py-6">
                                        <Search className="h-6 w-6 opacity-30 mb-2" />
                                        <p className="text-[10px]">Awaiting containment completion to start timeline analysis...</p>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Knowledge Curator Block */}
                                <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm flex flex-col min-h-[160px]">
                                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-3">
                                    <div className="flex items-center gap-2">
                                      <Brain className="h-4.5 w-4.5 text-amber-600" />
                                      <h3 className="font-bold text-xs text-slate-800">Self-Learning Knowledge Curator</h3>
                                    </div>
                                    {parsedReport.knowledge ? (
                                      <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-bold">DB UPDATED</span>
                                    ) : isRunning ? (
                                      <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold animate-pulse">WAITING</span>
                                    ) : (
                                      <span className="text-[10px] bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full font-bold">WAITING</span>
                                    )}
                                  </div>
                                  <div className="flex-1 overflow-y-auto max-h-[220px]">
                                    {parsedReport.knowledge ? (
                                      renderRichPanel(parsedReport.knowledge)
                                    ) : (
                                      <div className="flex flex-col items-center justify-center h-full text-slate-400 py-6">
                                        <Brain className="h-6 w-6 opacity-30 mb-2" />
                                        <p className="text-[10px]">Awaiting forensic RCA to optimize database specifications...</p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
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
                                onClick={() => {
                                  setSelectedHistoryItem(item);
                                  setActiveHistoryReportSubTab("safety");
                                }}
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
                  <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-6xl max-h-[85vh] overflow-hidden flex flex-col shadow-xl animate-fade-in">
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
                          onClick={() => {
                            const equipment = selectedHistoryItem.equipment || "Equipment";
                            const ts = new Date(selectedHistoryItem.timestamp).toLocaleString();
                            generatePDF(selectedHistoryItem.report || "", equipment, ts);
                          }}
                          className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-700 hover:bg-emerald-50 py-1 px-3 rounded-full border border-emerald-200 transition"
                        >
                          <Download className="h-3.5 w-3.5" />
                          <span>Export PDF</span>
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
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Swarm Reports & Containment Results:</div>
                        {!selectedHistoryItem.report ? (
                          <div className="bg-slate-50 border border-slate-200 p-5 rounded-xl text-xs text-slate-400 text-center py-8">
                            No report available.
                          </div>
                        ) : !selectedHistoryItem.report.includes("---") ? (
                          <div className="bg-slate-50 border border-slate-200 p-6 rounded-xl text-xs font-sans leading-relaxed text-slate-700 whitespace-pre-wrap max-h-96 overflow-y-auto">
                            {renderReportDocument(selectedHistoryItem.report, selectedHistoryItem.equipment)}
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                            {/* Left Column: Safety Incident Report (Span 7) */}
                            <div className="lg:col-span-7 bg-slate-50 border border-slate-200 p-6 rounded-xl flex flex-col min-h-[300px] max-h-[500px] overflow-y-auto shadow-sm">
                              <div className="flex items-center justify-between pb-2 border-b border-slate-200 mb-4">
                                <div className="flex items-center gap-2">
                                  <Shield className="h-4.5 w-4.5 text-[#0b57d0]" />
                                  <h4 className="font-bold text-xs text-slate-800">Safety Incident Report</h4>
                                </div>
                                <span className="text-[10px] bg-blue-50 text-[#0b57d0] px-2 py-0.5 rounded-full font-bold">Approved</span>
                              </div>
                              <div className="flex-1">
                                {renderReportDocument(parsedHistoryReport?.safety || selectedHistoryItem.report, selectedHistoryItem.equipment)}
                              </div>
                            </div>

                            {/* Right Column: stacked logs and reports (Span 5) */}
                            <div className="lg:col-span-5 flex flex-col gap-4">
                              {/* Execution Logs */}
                              {parsedHistoryReport?.execution && (
                                <div className="bg-slate-50 border border-slate-200 p-6 rounded-xl flex flex-col shadow-sm">
                                  <div className="flex items-center gap-2 pb-2 border-b border-slate-200 mb-3">
                                    <Activity className="h-4.5 w-4.5 text-purple-600" />
                                    <h4 className="font-bold text-xs text-slate-800 font-sans">Execution Logs</h4>
                                  </div>
                                  <div className="max-h-40 overflow-y-auto bg-slate-900 p-3 rounded-xl border border-slate-850 shadow-inner">
                                    {renderExecutionLogs(parsedHistoryReport.execution)}
                                  </div>
                                </div>
                              )}

                              {/* Detective Report */}
                              {parsedHistoryReport?.detective && (
                                <div className="bg-slate-50 border border-slate-200 p-6 rounded-xl flex flex-col max-h-[250px] overflow-y-auto shadow-sm">
                                  <div className="flex items-center gap-2 pb-2 border-b border-slate-200 mb-3">
                                    <Search className="h-4.5 w-4.5 text-rose-600" />
                                    <h4 className="font-bold text-xs text-slate-800 font-sans">Root Cause Analysis (RCA)</h4>
                                  </div>
                                  <div>
                                    {renderRichPanel(parsedHistoryReport.detective)}
                                  </div>
                                </div>
                              )}

                              {/* Knowledge Update */}
                              {parsedHistoryReport?.knowledge && (
                                <div className="bg-slate-50 border border-slate-200 p-6 rounded-xl flex flex-col max-h-[250px] overflow-y-auto shadow-sm">
                                  <div className="flex items-center gap-2 pb-2 border-b border-slate-200 mb-3">
                                    <Brain className="h-4.5 w-4.5 text-amber-600" />
                                    <h4 className="font-bold text-xs text-slate-800 font-sans">Knowledge Curator updates</h4>
                                  </div>
                                  <div>
                                    {renderRichPanel(parsedHistoryReport.knowledge)}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
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
