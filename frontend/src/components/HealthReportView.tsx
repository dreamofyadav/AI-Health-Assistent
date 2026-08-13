import React from 'react';
import { AlertTriangle, CheckCircle2, FileText, User, Clock, Activity } from 'lucide-react';

export interface HealthReport {
  patientName: string | null;
  chiefComplaint: string;
  duration: string | null;
  severity: string | null;
  associatedSymptoms: string[];
  flaggedForFollowUp: string[];
  callCompleteness: 'Complete' | 'Incomplete';
  summaryNotes: string;
}

interface Props {
  report: HealthReport;
  onReset: () => void;
}

export const HealthReportView: React.FC<Props> = ({ report, onReset }) => {
  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-xl shadow-lg border border-slate-200">
      <div className="flex justify-between items-center border-b pb-4 mb-6">
        <div className="flex items-center gap-2">
          <FileText className="text-blue-600" size={24} />
          <h2 className="text-xl font-bold text-slate-800">Intake Health Report</h2>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${
            report.callCompleteness === 'Complete'
              ? 'bg-green-100 text-green-800'
              : 'bg-amber-100 text-amber-800'
          }`}
        >
          {report.callCompleteness === 'Complete' ? (
            <CheckCircle2 size={14} />
          ) : (
            <AlertTriangle size={14} />
          )}
          {report.callCompleteness} Intake
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="p-3 bg-slate-50 rounded-lg">
          <div className="text-xs text-slate-500 flex items-center gap-1">
            <User size={12} /> Patient Name
          </div>
          <div className="font-semibold text-slate-700">{report.patientName || 'Not specified'}</div>
        </div>

        <div className="p-3 bg-slate-50 rounded-lg">
          <div className="text-xs text-slate-500 flex items-center gap-1">
            <Clock size={12} /> Symptom Duration
          </div>
          <div className="font-semibold text-slate-700">{report.duration || 'Not specified'}</div>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-600 flex items-center gap-1 mb-1">
            <Activity size={14} /> Chief Complaint & Severity
          </h3>
          <p className="p-3 bg-blue-50 text-blue-900 rounded-lg text-sm">
            {report.chiefComplaint} {report.severity ? `(Severity: ${report.severity})` : ''}
          </p>
        </div>

        {report.associatedSymptoms.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-slate-600 mb-1">Associated Symptoms</h3>
            <div className="flex flex-wrap gap-2">
              {report.associatedSymptoms.map((symptom, idx) => (
                <span key={idx} className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md text-xs">
                  {symptom}
                </span>
              ))}
            </div>
          </div>
        )}

        {report.flaggedForFollowUp.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-red-600 mb-1">Worth Following Up On</h3>
            <ul className="list-disc list-inside text-sm text-red-700 bg-red-50 p-3 rounded-lg space-y-1">
              {report.flaggedForFollowUp.map((flag, idx) => (
                <li key={idx}>{flag}</li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <h3 className="text-sm font-semibold text-slate-600 mb-1">Clinical Summary Notes</h3>
          <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg leading-relaxed">
            {report.summaryNotes}
          </p>
        </div>
      </div>

      <button
        onClick={onReset}
        className="mt-6 w-full py-2.5 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 transition"
      >
        Start New Screening Call
      </button>
    </div>
  );
};