import { X, Download } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  html: string;
  templateName: string;
  onDownload: () => void;
};

export default function ResumePreviewModal({ open, onClose, html, templateName, onDownload }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">
            Preview — {templateName}
          </h2>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onDownload}
              className="flex items-center gap-2 px-4 py-2 bg-[#6047f5] text-white rounded-xl font-semibold hover:shadow-lg transition-all text-sm"
            >
              <Download className="w-4 h-4" />
              Download
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Preview Frame */}
        <div className="flex-1 overflow-auto bg-gray-100 p-4">
          <iframe
            srcDoc={html}
            title="Resume Preview"
            className="w-full h-full rounded-lg shadow-inner bg-white"
            style={{ minHeight: "70vh" }}
          />
        </div>
      </div>
    </div>
  );
}
