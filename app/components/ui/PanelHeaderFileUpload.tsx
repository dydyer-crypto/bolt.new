import { memo, useRef } from 'react';
import { classNames } from '~/utils/classNames';

interface PanelHeaderFileInputProps {
  className?: string;
  disabledClassName?: string;
  disabled?: boolean;
  children: string | JSX.Element | Array<JSX.Element | string>;
  onChange?: (files: FileList | null) => void;
  folderSelection?: boolean;
}

export const PanelHeaderFileInput = memo(
  ({
    className,
    disabledClassName,
    disabled = false,
    children,
    onChange,
    folderSelection = false,
  }: PanelHeaderFileInputProps) => {
    const inputRef = useRef<HTMLInputElement>(null);

    const handleButtonClick = () => {
      if (disabled) return;
      inputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      onChange?.(files);
    };

    return (
      <>
        <button
          className={classNames(
            'flex items-center shrink-0 gap-1.5 px-1.5 rounded-md py-0.5 text-bolt-elements-item-contentDefault bg-transparent enabled:hover:text-bolt-elements-item-contentActive enabled:hover:bg-bolt-elements-item-backgroundActive disabled:cursor-not-allowed',
            {
              [classNames('opacity-30', disabledClassName)]: disabled,
            },
            className,
          )}
          disabled={disabled}
          onClick={handleButtonClick}
        >
          {children}
        </button>

        {/* Hidden file input */}
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={handleFileChange}
          multiple
          {...(folderSelection ? { webkitdirectory: 'true' } : {})}
        />
      </>
    );
  },
);
