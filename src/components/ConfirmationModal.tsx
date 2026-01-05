import { ReactNode } from 'react';
import { X, Check, AlertTriangle, Info } from 'lucide-react';
import { clsx } from 'clsx';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'success' | 'warning' | 'info';
  children?: ReactNode;
  showCancel?: boolean;
}

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'danger',
  children,
  showCancel = true
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-zinc-900 w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl border border-zinc-800 animate-in zoom-in-95 duration-200">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            {variant === 'danger' && <div className="p-3 rounded-full bg-red-500/10 text-red-500"><AlertTriangle size={24} /></div>}
            {variant === 'warning' && <div className="p-3 rounded-full bg-amber-500/10 text-amber-500"><AlertTriangle size={24} /></div>}
            {variant === 'success' && <div className="p-3 rounded-full bg-emerald-500/10 text-emerald-500"><Check size={24} /></div>}
            {variant === 'info' && <div className="p-3 rounded-full bg-blue-500/10 text-blue-500"><Info size={24} /></div>}
            <h2 className="text-xl font-bold text-white">{title}</h2>
          </div>
          
          {description && <p className="text-zinc-400 mb-6 leading-relaxed">{description}</p>}
          
          {children}

          <div className="flex gap-3 mt-6">
            {showCancel && (
              <button
                onClick={onClose}
                className="flex-1 py-3 px-4 rounded-xl font-bold text-zinc-400 bg-zinc-800 hover:bg-zinc-700 transition-colors flex items-center justify-center gap-2"
              >
                <X size={20} />
                {cancelText}
              </button>
            )}
            <button
              onClick={() => {
                if (onConfirm) onConfirm();
                onClose();
              }}
              className={clsx(
                "flex-1 py-3 px-4 rounded-xl font-bold text-white transition-colors flex items-center justify-center gap-2",
                variant === 'danger' ? "bg-red-600 hover:bg-red-500" : 
                variant === 'success' ? "bg-emerald-600 hover:bg-emerald-500" :
                variant === 'warning' ? "bg-amber-600 hover:bg-amber-500" :
                "bg-blue-600 hover:bg-blue-500"
              )}
            >
              <Check size={20} />
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
