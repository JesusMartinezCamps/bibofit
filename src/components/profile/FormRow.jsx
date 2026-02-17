import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import "react-datepicker/dist/react-datepicker.css";
import ReactDatePicker from 'react-datepicker';
import es from 'date-fns/locale/es';

const FormRow = ({ id, label, type = 'text', value, onChange, placeholder, options, color = 'green', className }) => {

  const handleInputChange = (e) => {
    onChange(id, e.target.value);
  };

  const handleSelectChange = (val) => {
    onChange(id, val);
  };
  
  const handleCheckboxChange = (checked) => {
    onChange(id, checked);
  };

  const handleDateChange = (date) => {
    onChange(id, date.toISOString().split('T')[0]);
  };
  
  const checkboxColorClass = color === 'green'
    ? "data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
    : "data-[state=checked]:bg-train-red data-[state=checked]:border-train-red";

  const renderInput = () => {
    switch (type) {
      case 'select':
        return (
          <Select value={value || ''} onValueChange={handleSelectChange}>
            <SelectTrigger id={id} className="w-full bg-gray-800 border-gray-700 text-white">
              <SelectValue placeholder={placeholder || 'Seleccionar...'} />
            </SelectTrigger>
            <SelectContent>
              {options.map((option, index) => (
                <SelectItem key={index} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case 'textarea':
        return (
          <Textarea
            id={id}
            value={value}
            onChange={handleInputChange}
            placeholder={placeholder}
            className={cn("w-full bg-gray-800 border-gray-700 text-white min-h-[100px]", className)}
          />
        );
      case 'checkbox':
        return (
          <div className="flex items-center space-x-2 h-10">
            <Checkbox
              id={id}
              checked={!!value}
              onCheckedChange={handleCheckboxChange}
              className={cn(checkboxColorClass)}
            />
            <Label htmlFor={id} className="cursor-pointer select-none text-gray-300">{label}</Label>
          </div>
        );
      case 'date':
        return (
          <ReactDatePicker
            selected={value ? new Date(value) : null}
            onChange={handleDateChange}
            dateFormat="dd/MM/yyyy"
            className="input-field w-full date-input"
            showYearDropdown
            scrollableYearDropdown
            yearDropdownItemNumber={60}
            locale={es}
          />
        );
      default:
        return (
          <Input
            id={id}
            type={type}
            value={value || ''}
            onChange={handleInputChange}
            placeholder={placeholder}
            className={cn("input-field", className)}
          />
        );
    }
  };

  return (
    <div className="flex flex-col space-y-1.5">
      {type !== 'checkbox' && <Label htmlFor={id} className="text-gray-300">{label}</Label>}
      {renderInput()}
    </div>
  );
};

export default FormRow;