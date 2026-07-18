'use client';

import { useEffect, useRef } from 'react';

/**
 * Detect clicks outside a referenced element.
 * Useful for closing dropdowns, modals, or popovers when clicking outside.
 *
 * @param handler - Callback function to execute when clicking outside
 * @returns A ref to attach to the element you want to monitor
 *
 * @example
 * ```tsx
 * const [isOpen, setIsOpen] = useState(false)
 * const dropdownRef = useClickOutside<HTMLDivElement>(() => setIsOpen(false))
 *
 * return (
 *   <div ref={dropdownRef}>
 *     {isOpen && <DropdownMenu />}
 *   </div>
 * )
 * ```
 */
export function useClickOutside<T extends HTMLElement>(handler: () => void): React.RefObject<T | null> {
  const ref = useRef<T>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;

      // Check if the click target is outside the referenced element
      if (ref.current && !ref.current.contains(target)) {
        handler();
      }
    };

    // Use mousedown and touchstart for immediate response
    // (before click event which fires after mouseup)
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [handler]);

  return ref;
}
