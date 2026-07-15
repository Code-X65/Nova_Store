import { useEffect, type ReactNode } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

const SIZE_CLASSES: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-3xl',
};

export interface ModalProps {
  /**
   * Controls visibility. Defaults to `true` so components that are only ever
   * conditionally *mounted* by their caller (`{open && <Modal ... />}`) don't
   * need to pass it. Components that keep the modal mounted and toggle
   * visibility themselves should pass `isOpen` explicitly.
   */
  isOpen?: boolean;
  onClose: () => void;
  /** Width preset. `sm`/`md` map to the compact confirm-dialog sizes, `lg`/`xl` to the larger form/content sizes. */
  size?: ModalSize;
  /**
   * `confirm` renders a single padded `glass-card` block (icon + title +
   * message + inline footer) matching the small delete/archive dialogs.
   * `panel` renders a bordered panel with a distinct header / scrollable
   * body / footer, matching the larger form-style modals.
   */
  variant?: 'confirm' | 'panel';
  title?: ReactNode;
  /** Extra classes for the header `<h2>`/`<h3>` — only used to tweak size/color, defaults match existing modals. */
  titleClassName?: string;
  description?: ReactNode;
  /** Pre-styled icon element (confirm variant only), e.g. a colored icon badge. */
  icon?: ReactNode;
  /** Extra controls rendered in the header before the close button (panel variant only). */
  headerExtra?: ReactNode;
  /** Footer content. Confirm variant right-aligns it with no border; panel variant adds a bordered footer bar. Omit to place actions in `children` instead. */
  footer?: ReactNode;
  children?: ReactNode;
  showCloseButton?: boolean;
  closeOnBackdropClick?: boolean;
  closeOnEscape?: boolean;
  /** Full override for the panel's background/border classes (replaces the default, doesn't merge). */
  panelClassName?: string;
  /** Full override for the backdrop's color/blur classes. */
  backdropClassName?: string;
  /** Full override for the header's border/background classes (panel variant). */
  headerClassName?: string;
  /** Full override for the footer's border/background classes (panel variant). */
  footerClassName?: string;
  /** Extra classes appended to the scrollable body (panel variant). */
  bodyClassName?: string;
  /** Full override for the outer fixed wrapper (use to bump z-index or padding). */
  wrapperClassName?: string;
  /** Panel variant only: override the `shadow-2xl` class, e.g. pass '' to rely on a `glass-card` panelClassName's own shadow. */
  shadowClassName?: string;
  /** Panel variant only: override the `max-h-[90vh]` cap. */
  maxHeightClassName?: string;
  /** Panel variant only: add the same `animate-in zoom-in-95 duration-150` entrance used by the confirm variant. */
  animated?: boolean;
  /** Panel variant only: override the header's `px-6 py-4` padding. */
  headerPaddingClassName?: string;
}

const DEFAULT_WRAPPER = 'fixed inset-0 z-50 flex items-center justify-center p-4';
const DEFAULT_BACKDROP = 'bg-black/60 backdrop-blur-sm';
const DEFAULT_PANEL_TONE = 'bg-[var(--neu-bg)] border border-[var(--panel-border)]';
const DEFAULT_HEADER_TONE = 'border-[var(--panel-border)] bg-[var(--neu-bg)]';
const DEFAULT_FOOTER_TONE = 'border-[var(--panel-border)] bg-[var(--neu-bg)]';
const DEFAULT_TITLE_CLASS = 'text-lg font-bold text-white flex items-center gap-2.5';

export function Modal({
  isOpen = true,
  onClose,
  size = 'md',
  variant = 'panel',
  title,
  titleClassName,
  description,
  icon,
  headerExtra,
  footer,
  children,
  showCloseButton = true,
  closeOnBackdropClick = true,
  closeOnEscape = true,
  panelClassName,
  backdropClassName = DEFAULT_BACKDROP,
  headerClassName,
  footerClassName,
  bodyClassName = '',
  wrapperClassName = DEFAULT_WRAPPER,
  shadowClassName = 'shadow-2xl',
  maxHeightClassName = 'max-h-[90vh]',
  animated = false,
  headerPaddingClassName = 'px-6 py-4',
}: ModalProps) {
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeOnEscape, onClose]);

  if (!isOpen) return null;

  const handleBackdropClick = closeOnBackdropClick ? onClose : undefined;

  if (variant === 'confirm') {
    return (
      <div className={wrapperClassName}>
        <div className={`absolute inset-0 ${backdropClassName}`} onClick={handleBackdropClick} />
        <div
          className={`relative z-10 w-full ${SIZE_CLASSES[size]} glass-card p-6 space-y-5 animate-in zoom-in-95 duration-150 ${panelClassName ?? ''}`}
        >
          {(icon || title) && (
            <div className="flex items-start gap-4">
              {icon}
              {title && (
                <div>
                  <h3 className={titleClassName ?? 'text-base font-bold text-white'}>{title}</h3>
                  {description && <p className="text-sm text-[var(--neu-text)] mt-1">{description}</p>}
                </div>
              )}
            </div>
          )}
          {children}
          {footer && <div className="flex justify-end gap-3">{footer}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className={wrapperClassName}>
      <div className={`absolute inset-0 ${backdropClassName}`} onClick={handleBackdropClick} />
      <div
        className={`relative w-full ${SIZE_CLASSES[size]} ${panelClassName ?? DEFAULT_PANEL_TONE} rounded-2xl ${shadowClassName} overflow-hidden flex flex-col ${maxHeightClassName} ${animated ? 'animate-in zoom-in-95 duration-150' : ''}`}
      >
        {(title || showCloseButton) && (
          <div className={`${headerPaddingClassName} flex items-center justify-between border-b ${headerClassName ?? DEFAULT_HEADER_TONE}`}>
            <div>
              {title && <h2 className={titleClassName ?? DEFAULT_TITLE_CLASS}>{title}</h2>}
              {description && <p className="text-sm text-[var(--neu-text)] mt-0.5">{description}</p>}
            </div>
            <div className="flex items-center gap-3">
              {headerExtra}
              {showCloseButton && (
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 text-[var(--neu-text)] hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        )}
        <div className={`p-6 overflow-y-auto flex-1 ${bodyClassName}`}>{children}</div>
        {footer && (
          <div className={`px-6 py-4 border-t flex justify-end gap-3 ${footerClassName ?? DEFAULT_FOOTER_TONE}`}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
