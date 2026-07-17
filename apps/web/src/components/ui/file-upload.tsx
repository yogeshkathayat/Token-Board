'use client';

import { File, Upload } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';

export interface FileUploadProps {
  accept?: string;
  maxSize?: number;
  onFileSelect: (file: File) => void;
  onError?: (error: string) => void;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
}

function FileUpload({
  accept,
  maxSize,
  onFileSelect,
  onError,
  disabled = false,
  className,
  children,
}: FileUploadProps) {
  const [isDragOver, setIsDragOver] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const validateFile = (file: File): boolean => {
    // Validate file type
    if (accept) {
      const acceptedTypes = accept.split(',').map((type) => type.trim());
      const fileExtension = `.${file.name.split('.').pop()?.toLowerCase()}`;
      const fileMimeType = file.type;

      const isValidType = acceptedTypes.some((type) => {
        if (type.startsWith('.')) {
          return fileExtension === type.toLowerCase();
        }
        if (type.endsWith('/*')) {
          return fileMimeType.startsWith(type.replace('/*', '/'));
        }
        return fileMimeType === type;
      });

      if (!isValidType) {
        onError?.(`Invalid file type. Accepted types: ${accept}`);
        return false;
      }
    }

    // Validate file size
    if (maxSize && file.size > maxSize) {
      const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(2);
      onError?.(`File size exceeds ${maxSizeMB}MB limit`);
      return false;
    }

    return true;
  };

  const handleFile = (file: File) => {
    if (validateFile(file)) {
      onFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (disabled) return;

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleClick = () => {
    if (!disabled) {
      inputRef.current?.click();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
    // Reset input value to allow selecting the same file again
    e.target.value = '';
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        'relative flex min-h-[150px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/50 px-6 py-10 text-center transition-colors',
        'hover:border-muted-foreground/50 hover:bg-muted',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        isDragOver && 'border-primary bg-primary/5',
        disabled && 'cursor-not-allowed opacity-50 hover:border-muted-foreground/25 hover:bg-muted/50',
        className,
      )}
      aria-label="File upload area"
      aria-disabled={disabled}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleInputChange}
        disabled={disabled}
        className="sr-only"
        aria-hidden="true"
      />
      {children ?? (
        <div className="flex flex-col items-center gap-2">
          <div className="rounded-full bg-muted p-3">
            {isDragOver ? (
              <File className="h-6 w-6 text-primary" aria-hidden="true" />
            ) : (
              <Upload className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
            )}
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              {isDragOver ? 'Drop file here' : 'Drag and drop or click to upload'}
            </p>
            {accept && <p className="text-xs text-muted-foreground">Accepted formats: {accept}</p>}
            {maxSize && (
              <p className="text-xs text-muted-foreground">Max size: {(maxSize / (1024 * 1024)).toFixed(0)}MB</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export { FileUpload };
