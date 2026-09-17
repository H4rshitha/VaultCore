import React, { useState, useEffect, useRef } from 'react';
import { Terminal, ChevronUp, ChevronDown, Trash2, Copy, Check, Filter, Clock } from 'lucide-react';
import { requestInspectorEmitter } from '../api/client.js';
import { Badge } from './ui/Badge.jsx';

export const DevInspector = () => {
  // Only active in development mode, hidden in production preview & build
  if (!import.meta.env.DEV) {
    return null;
  }

  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState([]);
  const [copiedId, setCopiedId] = useState(null);
  const [filterMethod, setFilterMethod] = useState('ALL');
  const logsContainerRef = useRef(null);

  useEffect(() => {
    const unsubscribe = requestInspectorEmitter.subscribe((entry) => {
      setLogs((prev) => [entry, ...prev].slice(0, 20)); // Keep only latest 20 requests
      // Auto-scroll newest request into view
      if (logsContainerRef.current) {
        logsContainerRef.current.scrollTop = 0;
      }
    });

    return () => unsubscribe();
  }, []);

  const handleCopy = (traceId) => {
    if (!traceId || traceId === 'N/A') return;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(traceId);
    }
    setCopiedId(traceId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const filteredLogs = logs.filter((log) => {
    if (filterMethod === 'ALL') return true;
    return log.method === filterMethod;
  });

  const getStatusBadgeVariant = (status) => {
    if (status >= 200 && status < 300) return 'success';
    if (status >= 300 && status < 400) return 'info';
    if (status >= 400 && status < 500) return 'warning';
    return 'danger';
  };

  const getMethodBadgeVariant = (method) => {
    switch (method) {
      case 'GET':
        return 'info';
      case 'POST':
        return 'success';
      case 'PUT':
      case 'PATCH':
        return 'warning';
      case 'DELETE':
        return 'danger';
      default:
        return 'neutral';
    }
  };

  const formatTimestamp = (isoString) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="fixed bottom-3 right-3 z-50 font-mono text-xs max-w-lg w-full px-3 sm:px-0">
      {/* Inspector Toggle Bar */}
      <div
        className="flex items-center justify-between bg-[#0D1322] border border-slate-700/80 rounded-xl px-4 py-2.5 shadow-2xl cursor-pointer hover:border-slate-600 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2.5 text-slate-200">
          <Terminal className="w-4 h-4 text-brand-400" />
          <span className="font-bold text-[11px] text-white">Dev Request Inspector</span>
          <span className="px-1.5 py-0.2 text-[10px] rounded bg-brand-500/20 text-brand-400 font-sans border border-brand-500/30">
            {logs.length}/20 calls
          </span>
        </div>

        <div className="flex items-center gap-2 text-slate-400">
          {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </div>
      </div>

      {/* Expanded Panel */}
      {isOpen && (
        <div className="mt-2 bg-[#0D1322] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden max-h-96 flex flex-col">
          {/* Panel Controls */}
          <div className="px-4 py-2.5 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={filterMethod}
                onChange={(e) => setFilterMethod(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-slate-300 rounded-lg px-2 py-1 text-[11px] focus:outline-none"
              >
                <option value="ALL">All Methods</option>
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PATCH">PATCH</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
              </select>
            </div>

            <button
              onClick={clearLogs}
              className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-rose-400 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear
            </button>
          </div>

          {/* Logs List */}
          <div
            ref={logsContainerRef}
            className="p-3 overflow-y-auto divide-y divide-slate-800/60 flex-1 space-y-2 scroll-smooth"
          >
            {filteredLogs.length === 0 ? (
              <p className="text-center py-6 text-slate-500 text-xs">
                No API requests recorded yet. Make some requests to inspect telemetry.
              </p>
            ) : (
              filteredLogs.map((log) => (
                <div key={log.id} className="pt-2 first:pt-0 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      <Badge variant={getMethodBadgeVariant(log.method)} size="sm">
                        {log.method}
                      </Badge>
                      <Badge variant={getStatusBadgeVariant(log.status)} size="sm">
                        {log.status || (log.error ? 'ERR' : 'OK')}
                      </Badge>
                      <span className="text-slate-300 truncate font-sans text-xs" title={log.url}>
                        {log.url}
                      </span>
                    </div>

                    <span className="text-[10px] text-slate-400 flex-shrink-0 font-mono">
                      {log.responseTime}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                    <div className="flex items-center gap-2 truncate">
                      <span className="truncate font-mono">Trace: {log.traceId}</span>
                      <span className="text-slate-500 flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        {formatTimestamp(log.timestamp)}
                      </span>
                    </div>

                    <button
                      onClick={() => handleCopy(log.traceId)}
                      className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors flex-shrink-0"
                      title="Copy X-Trace-ID"
                    >
                      {copiedId === log.traceId ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
