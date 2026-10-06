import { Eye, Download } from "lucide-react";

type Template = {
  id: string;
  name: string;
  description: string;
  thumbnail: string; // CSS gradient or placeholder
};

const TEMPLATES: Template[] = [
  {
    id: "classic",
    name: "Classic",
    description: "Single-column traditional ATS-friendly layout",
    thumbnail: "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)",
  },
  {
    id: "modern",
    name: "Modern Split",
    description: "Two-column sidebar with indigo accent",
    thumbnail: "linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 50%, #f0f0ff 100%)",
  },
  {
    id: "professional",
    name: "Professional",
    description: "Blue header bar with clean structured sections",
    thumbnail: "linear-gradient(135deg, #dbeafe 0%, #bfdbfe 50%, #eff6ff 100%)",
  },
];

type Props = {
  selected: string;
  onSelect: (id: string) => void;
  onPreview: (id: string) => void;
  onDownload: (id: string) => void;
};

export { TEMPLATES };

export default function ResumeTemplateCard({ selected, onSelect, onPreview, onDownload }: Props) {
  return (
    <div className="grid gap-4">
      {TEMPLATES.map((tmpl) => {
        const isActive = selected === tmpl.id;
        return (
          <div
            key={tmpl.id}
            onClick={() => onSelect(tmpl.id)}
            className={`bg-white rounded-2xl border-2 overflow-hidden cursor-pointer transition-all hover:shadow-md ${
              isActive ? "border-purple-500 ring-2 ring-purple-200" : "border-gray-200"
            }`}
          >
            {/* Thumbnail */}
            <div
              style={{ background: tmpl.thumbnail }}
              className="h-24 flex items-center justify-center"
            >
              <div className="bg-white/70 backdrop-blur-sm rounded-lg px-4 py-2 shadow-sm">
                <span className="text-sm font-bold text-gray-800">{tmpl.name}</span>
              </div>
            </div>

            {/* Info + Actions */}
            <div className="p-4">
              <p className="text-xs text-gray-600 mb-3">{tmpl.description}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onPreview(tmpl.id); }}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-semibold text-gray-700 transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Preview
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onDownload(tmpl.id); }}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-[#6047f5] hover:shadow-md text-white rounded-lg text-xs font-semibold transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
