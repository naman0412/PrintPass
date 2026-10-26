import React, { useState, useRef } from 'react';
import { UploadCloud, File, CheckCircle2, AlertCircle, ShieldCheck, RefreshCw } from 'lucide-react';
import { api } from '../../services/api';

export const FileUpload = ({ onFileUploaded, currentFile }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFile = async (file) => {
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      setError('File size exceeds the 20 MB limit.');
      return;
    }

    setError(null);
    setUploading(true);

    try {
      const data = await api.uploadFile(file);
      if (data.success && data.file) {
        onFileUploaded({
          ...data.file,
          infoMessage: data.message
        });
      }
    } catch (err) {
      setError(err.message || 'Failed to upload document. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const onDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-bold uppercase tracking-wider text-slate-500">
          2. Upload Document
        </label>
        <span className="text-xs text-slate-400">PDF, Office, Images (Max 20MB)</span>
      </div>

      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
          isDragging
            ? 'border-indigo-600 bg-indigo-50/70 scale-[0.99]'
            : currentFile
            ? 'border-emerald-400 bg-emerald-50/30'
            : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50/80 bg-white'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png"
          onChange={(e) => e.target.files && handleFile(e.target.files[0])}
        />

        {uploading ? (
          <div className="py-6 flex flex-col items-center gap-2">
            <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
            <p className="font-bold text-slate-800">Processing & Analyzing Pages...</p>
            <p className="text-xs text-slate-500">Converting non-PDF and calculating exact page count</p>
          </div>
        ) : currentFile ? (
          <div className="py-2 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-left">
              <div className="p-3 bg-emerald-100 text-emerald-700 rounded-xl">
                <File className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-1.5 font-bold text-slate-900">
                  <span className="truncate max-w-[200px] sm:max-w-xs">{currentFile.originalFilename}</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                  <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">
                    {currentFile.pageCount} {currentFile.pageCount === 1 ? 'Page' : 'Pages'}
                  </span>
                  <span>•</span>
                  <span>{(currentFile.fileSize / (1024 * 1024)).toFixed(2)} MB</span>
                  {currentFile.isConverted && (
                    <span className="text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded text-[10px] font-semibold">
                      Auto-Converted to PDF
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3 py-1.5 rounded-lg shrink-0"
            >
              Replace
            </button>
          </div>
        ) : (
          <div className="py-4 flex flex-col items-center">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
              <UploadCloud className="w-6 h-6" />
            </div>
            <p className="font-bold text-slate-800 text-sm sm:text-base">
              Click or drag document here to upload
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Supports PDF, DOC, DOCX, PPT, PPTX, JPG, PNG
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Critical Privacy Notice Banner */}
      <div className="flex items-start gap-2 p-2.5 rounded-xl bg-slate-100/70 border border-slate-200 text-slate-600 text-xs">
        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-slate-800">Strict Privacy Guarantee: </span>
          The shopkeeper cannot preview or save your files. Documents are printed directly by our automated print agent and permanently erased the moment you collect your print.
        </div>
      </div>
    </div>
  );
};
