import React, { forwardRef, useMemo, useRef } from 'react';
import DatePicker from 'react-datepicker';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { format, getMonth, getYear } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const DateTrigger = forwardRef(
  (
    {
      value,
      onClick,
      placeholder,
      disabled,
      className,
      id,
      variant = 'default',
      align = 'left',
      weight = 'normal',
    },
    ref
  ) => {
    const variantClass = {
      default: '',
      compact: 'min-h-[40px] rounded-lg px-3 py-2 text-xs',
      pill: 'min-h-[40px] rounded-full px-3 py-2 text-xs',
    }[variant] || '';

    return (
      <button
        id={id}
        ref={ref}
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={cn('bf-date-trigger', variantClass, className)}
      >
        <span
          className={cn(
            'truncate',
            align === 'center' ? 'flex-1 text-center' : 'text-left',
            weight === 'semibold' ? 'font-semibold' : 'font-normal',
            !value && 'text-muted-foreground'
          )}
        >
          {value || placeholder || 'Seleccionar fecha'}
        </span>
        <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>
    );
  }
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
  variant = 'default',
  align = 'left',
  weight = 'normal',
  minYear = 1920,
  maxYear = new Date().getFullYear() + 10,
  withPortal = false,
  shouldCloseOnSelect,
  showPortalCloseButton,
  portalCloseLabel = 'Cerrar calendario',
  calendarContainer,
  popperModifiers,
  ...props
}) => {
  const datePickerRef = useRef(null);
  const monthNames = useMemo(() => getMonthNames(locale), [locale]);
  const yearOptions = useMemo(() => getYearOptions(minYear, maxYear), [minYear, maxYear]);
  const effectiveVariant = compact && variant === 'default' ? 'compact' : variant;
  const shouldRenderPortalCloseButton = showPortalCloseButton ?? withPortal;
  const effectivePopperModifiers = useMemo(
    () =>
      popperModifiers ?? [
        { name: 'offset', options: { offset: [0, 8] } },
        {
          name: 'preventOverflow',
          options: {
            rootBoundary: 'viewport',
            padding: 8,
            tether: true,
            altAxis: true,
          },
        },
        { name: 'flip', options: { padding: 8 } },
      ],
    [popperModifiers]
  );
  const effectiveCalendarContainer =
    calendarContainer ??
    (({ className: calendarContainerClassName, children }) => (
      <div className={calendarContainerClassName}>
        {children}
        {withPortal && shouldRenderPortalCloseButton && (
          <div className="pt-3 pb-2">
            <button
              type="button"
              onClick={() => datePickerRef.current?.setOpen(false)}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-border bg-muted/70 px-4 text-base font-semibold text-foreground transition-colors hover:bg-muted"
              aria-label={portalCloseLabel}
            >
              <X className="h-6 w-6" />
              <span>{portalCloseLabel}</span>
            </button>
          </div>
        )}
      </div>
    ));

  return (
    <DatePicker
      ref={datePickerRef}
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
      popperModifiers={effectivePopperModifiers}
      calendarContainer={effectiveCalendarContainer}
      customInput={
        <DateTrigger
          id={id}
          placeholder={placeholder}
          variant={effectiveVariant}
          align={align}
          weight={weight}
          className={triggerClassName}
        />
      }
      wrapperClassName={cn('w-full', className)}
      calendarClassName={cn(calendarClassName, 'bf-datepicker')}
      popperClassName={cn(popperClassName, 'bf-datepicker-popper')}
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
