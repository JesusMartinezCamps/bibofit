import React, { forwardRef, useMemo } from 'react';
import DatePicker from 'react-datepicker';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, getMonth, getYear } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const DateTrigger = forwardRef(
  ({ value, onClick, placeholder, disabled, className, id, compact = false }, ref) => (
    <button
      id={id}
      ref={ref}
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'bf-date-trigger',
        compact ? 'bf-date-trigger--compact' : '',
        className
      )}
    >
      <span className={cn('truncate text-left', !value && 'text-gray-400')}>
        {value || placeholder || 'Seleccionar fecha'}
      </span>
      <Calendar className="h-4 w-4 shrink-0 text-gray-300" />
    </button>
  )
);

DateTrigger.displayName = 'DateTrigger';

const getMonthNames = (locale) =>
  Array.from({ length: 12 }, (_, monthIndex) =>
    format(new Date(2024, monthIndex, 1), 'LLLL', { locale })
  );

const getYearOptions = (minYear, maxYear) => {
  const years = [];
  for (let year = maxYear; year >= minYear; year -= 1) {
    years.push(year);
  }
  return years;
};

const UnifiedDatePicker = ({
  id,
  selected = null,
  onChange,
  startDate,
  endDate,
  selectsRange = false,
  placeholder = 'Selecciona fecha',
  dateFormat = 'dd/MM/yyyy',
  disabled = false,
  minDate,
  maxDate,
  locale = es,
  className,
  triggerClassName,
  calendarClassName,
  popperClassName,
  compact = false,
  minYear = 1920,
  maxYear = new Date().getFullYear() + 10,
  withPortal = false,
  shouldCloseOnSelect,
  ...props
}) => {
  const monthNames = useMemo(() => getMonthNames(locale), [locale]);
  const yearOptions = useMemo(() => getYearOptions(minYear, maxYear), [minYear, maxYear]);

  return (
    <DatePicker
      id={id}
      selected={selected}
      onChange={onChange}
      startDate={startDate}
      endDate={endDate}
      selectsRange={selectsRange}
      disabled={disabled}
      minDate={minDate}
      maxDate={maxDate}
      locale={locale}
      dateFormat={dateFormat}
      withPortal={withPortal}
      shouldCloseOnSelect={shouldCloseOnSelect ?? !selectsRange}
      popperPlacement="bottom-start"
      customInput={
        <DateTrigger
          id={id}
          placeholder={placeholder}
          compact={compact}
          className={triggerClassName}
        />
      }
      wrapperClassName={cn('w-full', className)}
      calendarClassName={cn('bf-datepicker', calendarClassName)}
      popperClassName={cn('bf-datepicker-popper', popperClassName)}
      renderCustomHeader={({
        date,
        changeYear,
        changeMonth,
        decreaseMonth,
        increaseMonth,
        prevMonthButtonDisabled,
        nextMonthButtonDisabled,
      }) => (
        <div className="bf-datepicker__header-controls">
          <button
            type="button"
            onClick={decreaseMonth}
            disabled={prevMonthButtonDisabled}
            className="bf-datepicker__nav-btn"
            aria-label="Mes anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div className="bf-datepicker__selectors">
            <select
              className="bf-datepicker__select"
              value={getMonth(date)}
              onChange={({ target: { value } }) => changeMonth(Number(value))}
              aria-label="Seleccionar mes"
            >
              {monthNames.map((monthName, monthIndex) => (
                <option key={monthName} value={monthIndex}>
                  {monthName.charAt(0).toUpperCase() + monthName.slice(1)}
                </option>
              ))}
            </select>

            <select
              className="bf-datepicker__select"
              value={getYear(date)}
              onChange={({ target: { value } }) => changeYear(Number(value))}
              aria-label="Seleccionar año"
            >
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={increaseMonth}
            disabled={nextMonthButtonDisabled}
            className="bf-datepicker__nav-btn"
            aria-label="Mes siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
      {...props}
    />
  );
};

export default UnifiedDatePicker;