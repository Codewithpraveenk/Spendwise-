import { useEffect, useId, useRef } from 'react';

export default function Modal({ title, description, onClose, children }) {
  const dialogRef = useRef(null);
  const headingId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    dialog.showModal();
    return () => {
      dialog.close();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
      else document.querySelector('main')?.focus({ preventScroll: true });
    };
  }, []);

  return (
    <dialog ref={dialogRef} aria-labelledby={headingId} aria-describedby={descriptionId} onCancel={(event) => { event.preventDefault(); onClose(); }} className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-0 text-slate-800 shadow-xl backdrop:bg-slate-950/40">
      <div className="p-5 sm:p-6">
        <h2 id={headingId} className="break-words text-xl font-semibold">{title}</h2>
        <p id={descriptionId} className="mt-2 break-words text-sm leading-6 text-slate-500">{description}</p>
        {children}
      </div>
    </dialog>
  );
}
