import React, { useState, useEffect } from 'react';
import './CrashReportViewer.css';

interface CrashReport {
  id: string;
  timestamp: string;
  version: string;
  platform: string;
  arch: string;
  error: string;
  stack?: string;
  metadata?: Record<string, any>;
}

interface CrashReportViewerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CrashReportViewer: React.FC<CrashReportViewerProps> = ({ isOpen, onClose }) => {
  const [crashReports, setCrashReports] = useState<CrashReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<CrashReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadCrashReports();
    }
  }, [isOpen]);

  const loadCrashReports = async () => {
    setIsLoading(true);
    try {
      const reports = await window.electronAPI?.invoke('get-crash-reports') || [];
      setCrashReports(reports);
    } catch (error) {
      console.error('Failed to load crash reports:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    try {
      const result = await window.electronAPI?.invoke('delete-crash-report', reportId);
      if (result?.success) {
        setCrashReports(reports => reports.filter(r => r.id !== reportId));
        if (selectedReport?.id === reportId) {
          setSelectedReport(null);
        }
      }
    } catch (error) {
      console.error('Failed to delete crash report:', error);
    }
  };

  const handleClearAllReports = async () => {
    if (!confirm('Are you sure you want to delete all crash reports?')) {
      return;
    }

    try {
      const result = await window.electronAPI?.invoke('clear-crash-reports');
      if (result?.success) {
        setCrashReports([]);
        setSelectedReport(null);
      }
    } catch (error) {
      console.error('Failed to clear crash reports:', error);
    }
  };

  const formatTimestamp = (timestamp: string): string => {
    return new Date(timestamp).toLocaleString();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      // Could show a toast notification here
    }).catch(err => {
      console.error('Failed to copy to clipboard:', err);
    });
  };

  const exportReport = (report: CrashReport) => {
    const reportText = `NoteSage Crash Report
ID: ${report.id}
Timestamp: ${formatTimestamp(report.timestamp)}
Version: ${report.version}
Platform: ${report.platform} (${report.arch})

Error: ${report.error}

Stack Trace:
${report.stack || 'No stack trace available'}

Metadata:
${JSON.stringify(report.metadata, null, 2)}
`;

    const blob = new Blob([reportText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `crash-report-${report.id}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="crash-report-overlay">
      <div className="crash-report-viewer">
        <div className="crash-report-header">
          <h2>Crash Reports</h2>
          <div className="header-actions">
            {crashReports.length > 0 && (
              <button 
                className="clear-all-button"
                onClick={handleClearAllReports}
              >
                Clear All
              </button>
            )}
            <button className="close-button" onClick={onClose}>×</button>
          </div>
        </div>

        <div className="crash-report-content">
          {isLoading ? (
            <div className="loading">
              <div className="spinner"></div>
              <p>Loading crash reports...</p>
            </div>
          ) : crashReports.length === 0 ? (
            <div className="no-reports">
              <p>No crash reports found.</p>
              <p className="subtitle">This is good news! Your application has been running smoothly.</p>
            </div>
          ) : (
            <div className="crash-report-layout">
              <div className="reports-list">
                <h3>Reports ({crashReports.length})</h3>
                {crashReports.map(report => (
                  <div
                    key={report.id}
                    className={`report-item ${selectedReport?.id === report.id ? 'selected' : ''}`}
                    onClick={() => setSelectedReport(report)}
                  >
                    <div className="report-summary">
                      <div className="report-error">{report.error}</div>
                      <div className="report-meta">
                        <span className="report-time">{formatTimestamp(report.timestamp)}</span>
                        <span className="report-version">v{report.version}</span>
                      </div>
                    </div>
                    <button
                      className="delete-report-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteReport(report.id);
                      }}
                      title="Delete this report"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              <div className="report-details">
                {selectedReport ? (
                  <div className="report-detail-content">
                    <div className="report-detail-header">
                      <h3>Crash Report Details</h3>
                      <div className="detail-actions">
                        <button
                          onClick={() => copyToClipboard(JSON.stringify(selectedReport, null, 2))}
                          title="Copy report to clipboard"
                        >
                          Copy
                        </button>
                        <button
                          onClick={() => exportReport(selectedReport)}
                          title="Export report as text file"
                        >
                          Export
                        </button>
                      </div>
                    </div>

                    <div className="report-info">
                      <div className="info-grid">
                        <div className="info-item">
                          <label>ID:</label>
                          <span>{selectedReport.id}</span>
                        </div>
                        <div className="info-item">
                          <label>Timestamp:</label>
                          <span>{formatTimestamp(selectedReport.timestamp)}</span>
                        </div>
                        <div className="info-item">
                          <label>Version:</label>
                          <span>{selectedReport.version}</span>
                        </div>
                        <div className="info-item">
                          <label>Platform:</label>
                          <span>{selectedReport.platform} ({selectedReport.arch})</span>
                        </div>
                      </div>

                      <div className="error-section">
                        <label>Error:</label>
                        <div className="error-text">{selectedReport.error}</div>
                      </div>

                      {selectedReport.stack && (
                        <div className="stack-section">
                          <label>Stack Trace:</label>
                          <pre className="stack-trace">{selectedReport.stack}</pre>
                        </div>
                      )}

                      {selectedReport.metadata && (
                        <div className="metadata-section">
                          <label>Metadata:</label>
                          <pre className="metadata">{JSON.stringify(selectedReport.metadata, null, 2)}</pre>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="no-selection">
                    <p>Select a crash report to view details</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};