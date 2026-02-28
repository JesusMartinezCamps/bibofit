import React, { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const EditableField = ({
  value,
  onChange,
  isEditing,
  placeholder,
  type = 'input',
  options = [],
  className = '',
}) => {
  const textareaRef = useRef(null);

  useEffect(() => {
    if (isEditing && type === 'textarea' && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [value, isEditing, type]);

  if (!isEditing) {
    if (type === 'p') {
      return <p className={cn('text-gray-300 whitespace-pre-wrap', className)}>{value || placeholder}</p>;
    }
    return <span className={cn('text-gray-300', className)}>{value || placeholder}</span>;
  }

  if (type === 'textarea') {
    const handleAutoGrow = (e) => {
      e.target.style.height = 'auto';
      e.target.style.height = `${e.target.scrollHeight}px`;
      onChange(e);
    };

    return (
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleAutoGrow}
        placeholder={placeholder}
        className={cn(
          'input-field w-full bg-transparent border-dashed resize-none overflow-hidden',
          className
        )}
        style={{
          minHeight: '50px',
          whiteSpace: 'pre-wrap',
        }}
      />
    );
  }

  if (type === 'select') {
    return (
      <Select name={onChange.name} value={value} onValueChange={onChange}>
        <SelectTrigger
          className={cn(
            'input-field bg-transparent border-dashed w-auto',
            isEditing && 'sm:pr-1 sm:pl-2',
            className
          )}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="bg-[#282d34] border border-gray-700 text-white">
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} className="focus:bg-gray-700 focus:text-white">
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <Input
      name={onChange.name}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={cn(
        'input-field h-auto p-0 bg-transparent border-dashed',
        className,
        isEditing && 'sm:p-0.5'
      )}
    />
  );
};

export default EditableField;
