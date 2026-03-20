import { format } from 'date-fns';

export const getDateKey = (date = new Date()) => format(date, 'yyyy-MM-dd');
