'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  parseISO,
  isSameDay,
  addMonths,
  subMonths,
  isSameMonth,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Loader2, Pencil, Plus, StickyNote, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/app/auth/auth-context';
import axios from '@/lib/api/axios';
import { cn } from '@/lib/utils';
import QuillEditor, { isEmptyQuillHtml, quillHtmlToPreview } from '@/components/QuillEditor';

interface CalendarNote {
  NoteID: number;
  NoteDate: string;
  Content: string;
  CreatedAt?: string;
  UpdatedAt?: string;
}

interface Holiday {
  date: string;
  name: string;
  type?: string;
  public?: boolean;
}

function toDateKey(value: Date | string): string {
  if (typeof value === 'string') {
    return value.slice(0, 10);
  }
  return format(value, 'yyyy-MM-dd');
}

function parseNoteDate(value: string): Date {
  return parseISO(toDateKey(value));
}

export default function CalendarNotesWidget() {
  const { user } = useAuth();
  const today = useMemo(() => new Date(), []);
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [month, setMonth] = useState<Date>(startOfMonth(today));
  const [monthNotes, setMonthNotes] = useState<CalendarNote[]>([]);
  const [dayNotes, setDayNotes] = useState<CalendarNote[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [isLoadingMonth, setIsLoadingMonth] = useState(true);
  const [isLoadingDay, setIsLoadingDay] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<CalendarNote | null>(null);
  const [editorHtml, setEditorHtml] = useState('');
  const [editorError, setEditorError] = useState<string | null>(null);

  const businessLineId = user?.currentBusinessLine;
  const selectedKey = toDateKey(selectedDate);
  const monthYear = month.getFullYear();
  const viewingCurrentMonth = isSameMonth(month, today);

  const noteDates = useMemo(() => {
    const unique = new Set(monthNotes.map((note) => toDateKey(note.NoteDate)));
    return Array.from(unique).map((key) => parseNoteDate(key));
  }, [monthNotes]);

  const holidayDates = useMemo(
    () => holidays.map((holiday) => parseISO(holiday.date)),
    [holidays]
  );

  const selectedHoliday = useMemo(
    () => holidays.find((holiday) => holiday.date === selectedKey),
    [holidays, selectedKey]
  );

  const monthHolidays = useMemo(() => {
    const monthIndex = month.getMonth();
    return holidays.filter((holiday) => {
      const date = parseISO(holiday.date);
      return date.getFullYear() === monthYear && date.getMonth() === monthIndex;
    });
  }, [holidays, month, monthYear]);

  const goToMonth = useCallback((nextMonth: Date) => {
    setMonth(startOfMonth(nextMonth));
  }, []);

  const goToPreviousMonth = () => goToMonth(subMonths(month, 1));
  const goToNextMonth = () => goToMonth(addMonths(month, 1));
  const goToToday = () => {
    const now = new Date();
    setSelectedDate(now);
    goToMonth(now);
  };

  const fetchMonthData = useCallback(async () => {
    if (!businessLineId) {
      setIsLoadingMonth(false);
      return;
    }

    setIsLoadingMonth(true);
    setError(null);

    const from = format(startOfMonth(month), 'yyyy-MM-dd');
    const to = format(endOfMonth(month), 'yyyy-MM-dd');

    try {
      const [notesRes, holidaysRes] = await Promise.all([
        axios.get('/calendar-notes', {
          params: { businessLineId, from, to },
        }),
        axios.get('/holidays', {
          params: { year: monthYear, type: 'public' },
        }),
      ]);

      setMonthNotes(notesRes.data?.data || []);
      setHolidays(holidaysRes.data?.data?.holidays || []);
    } catch (err) {
      console.error('Failed to load calendar data:', err);
      setError('Could not load calendar notes or holidays.');
    } finally {
      setIsLoadingMonth(false);
      setHasLoadedOnce(true);
    }
  }, [businessLineId, month, monthYear]);

  const fetchDayNotes = useCallback(async () => {
    if (!businessLineId) return;

    setIsLoadingDay(true);
    try {
      const response = await axios.get('/calendar-notes', {
        params: { businessLineId, date: selectedKey },
      });
      setDayNotes(response.data?.data || []);
    } catch (err) {
      console.error('Failed to load day notes:', err);
      setDayNotes([]);
    } finally {
      setIsLoadingDay(false);
    }
  }, [businessLineId, selectedKey]);

  useEffect(() => {
    fetchMonthData();
  }, [fetchMonthData]);

  useEffect(() => {
    fetchDayNotes();
  }, [fetchDayNotes]);

  const openCreateEditor = () => {
    setEditingNote(null);
    setEditorHtml('');
    setEditorError(null);
    setEditorOpen(true);
  };

  const openEditEditor = (note: CalendarNote) => {
    setEditingNote(note);
    setEditorHtml(note.Content || '');
    setEditorError(null);
    setEditorOpen(true);
  };

  const handleSaveNote = async () => {
    if (!businessLineId) return;

    if (isEmptyQuillHtml(editorHtml)) {
      setEditorError('Please add some note content.');
      return;
    }

    setIsSaving(true);
    setEditorError(null);
    setError(null);

    try {
      if (editingNote) {
        const response = await axios.put(`/calendar-notes/${editingNote.NoteID}`, {
          businessLineId,
          content: editorHtml,
        });
        const saved = response.data?.data as CalendarNote;
        setDayNotes((prev) =>
          prev.map((note) => (note.NoteID === saved.NoteID ? saved : note))
        );
        setMonthNotes((prev) =>
          prev.map((note) => (note.NoteID === saved.NoteID ? saved : note))
        );
      } else {
        const response = await axios.post('/calendar-notes', {
          businessLineId,
          date: selectedKey,
          content: editorHtml,
        });
        const saved = response.data?.data as CalendarNote;
        setDayNotes((prev) => [...prev, saved]);
        setMonthNotes((prev) => [...prev, saved]);
      }
      setEditorOpen(false);
      setEditingNote(null);
      setEditorHtml('');
    } catch (err) {
      console.error('Failed to save note:', err);
      setEditorError('Could not save note.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteNote = async (note: CalendarNote) => {
    if (!businessLineId) return;
    if (!window.confirm('Delete this note?')) return;

    setIsSaving(true);
    setError(null);

    try {
      await axios.delete(`/calendar-notes/${note.NoteID}`, {
        params: { businessLineId },
      });
      setDayNotes((prev) => prev.filter((item) => item.NoteID !== note.NoteID));
      setMonthNotes((prev) => prev.filter((item) => item.NoteID !== note.NoteID));
      if (editingNote?.NoteID === note.NoteID) {
        setEditorOpen(false);
        setEditingNote(null);
        setEditorHtml('');
      }
    } catch (err) {
      console.error('Failed to delete note:', err);
      setError('Could not delete note.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectDate = (date?: Date) => {
    if (!date) return;
    setSelectedDate(date);
    if (!isSameMonth(date, month)) {
      goToMonth(date);
    }
  };

  return (
    <Card className="shadow-md h-full flex flex-col">
      <CardHeader className="pb-3 space-y-3">
        <div>
          <CardTitle className="text-lg">Calendar</CardTitle>
          <CardDescription>
            Add multiple notes per day. Public holidays are highlighted.
          </CardDescription>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={goToPreviousMonth}
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="flex-1 min-w-0 text-center px-1">
            <p className="text-sm font-semibold leading-tight truncate">
              {format(month, 'MMM yyyy')}
            </p>
            {isLoadingMonth && hasLoadedOnce && (
              <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1 mt-0.5">
                <Loader2 className="h-3 w-3 animate-spin" />
                Updating…
              </p>
            )}
          </div>

          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={goToNextMonth}
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          <Button
            type="button"
            variant={viewingCurrentMonth ? 'secondary' : 'outline'}
            size="sm"
            className="shrink-0 h-8 px-2 text-xs"
            onClick={goToToday}
          >
            Today
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col gap-4 min-h-0 pt-0">
        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="relative rounded-lg border bg-muted/20 overflow-hidden">
          {!hasLoadedOnce && isLoadingMonth ? (
            <Skeleton className="h-[280px] w-full rounded-none" />
          ) : (
            <Calendar
              mode="single"
              month={month}
              onMonthChange={goToMonth}
              selected={selectedDate}
              onSelect={handleSelectDate}
              hideNavigation
              modifiers={{
                holiday: holidayDates,
                hasNote: noteDates,
              }}
              modifiersClassNames={{
                holiday:
                  'bg-rose-100 text-rose-800 hover:bg-rose-200 dark:bg-rose-950 dark:text-rose-200',
                hasNote: 'font-semibold underline decoration-primary underline-offset-4',
              }}
              className="w-full p-2 sm:p-3"
              classNames={{
                root: 'w-full p-0',
                months: 'w-full',
                month: 'w-full space-y-3',
                month_caption: 'hidden',
                nav: 'hidden',
                month_grid: 'w-full border-collapse',
                weekdays: 'flex w-full',
                weekday:
                  'text-muted-foreground rounded-md flex-1 font-medium text-[0.7rem] uppercase tracking-wide py-1',
                week: 'flex w-full mt-1',
                day: 'relative p-0 text-center text-sm flex-1 aspect-square',
                day_button: cn(
                  'h-full w-full p-0 font-normal rounded-md hover:bg-accent aria-selected:opacity-100'
                ),
                today: 'bg-accent/70 text-accent-foreground font-semibold ring-1 ring-border',
                selected:
                  'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground',
                outside: 'text-muted-foreground/50 opacity-60',
              }}
            />
          )}
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-rose-200 dark:bg-rose-800" />
            Holiday
          </span>
          <span className="inline-flex items-center gap-1.5">
            <StickyNote className="h-3 w-3 text-primary" />
            Has notes
          </span>
        </div>

        <div className="space-y-2 min-h-0 flex flex-col">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">
                {format(selectedDate, 'EEE, MMM d, yyyy')}
              </p>
              {selectedHoliday ? (
                <p className="text-xs text-rose-700 dark:text-rose-300 mt-0.5 line-clamp-2">
                  {selectedHoliday.name}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground mt-0.5">No public holiday</p>
              )}
            </div>
            <Button
              type="button"
              size="sm"
              className="shrink-0 h-8"
              onClick={openCreateEditor}
              disabled={!businessLineId}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add
            </Button>
          </div>

          <div className="min-h-0 max-h-[180px] overflow-auto space-y-2 pr-0.5">
            {isLoadingDay ? (
              <>
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </>
            ) : dayNotes.length === 0 ? (
              <p className="text-sm text-muted-foreground border border-dashed rounded-md px-3 py-4 text-center">
                No notes for this day yet.
              </p>
            ) : (
              dayNotes.map((note) => {
                const preview = quillHtmlToPreview(note.Content);
                return (
                  <div
                    key={note.NoteID}
                    className="rounded-md border bg-background px-2.5 py-2 space-y-2"
                  >
                    <p className="text-sm leading-snug line-clamp-3">
                      {preview || 'Empty note'}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => openEditEditor(note)}
                      >
                        <Pencil className="mr-1 h-3 w-3" />
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                        onClick={() => handleDeleteNote(note)}
                        disabled={isSaving}
                      >
                        <Trash2 className="mr-1 h-3 w-3" />
                        Delete
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto border-t pt-3">
          <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
            Holidays in {format(month, 'MMMM')}
          </p>
          {monthHolidays.length === 0 ? (
            <p className="text-sm text-muted-foreground">No public holidays this month.</p>
          ) : (
            <ul className="space-y-1.5">
              {monthHolidays.map((holiday) => {
                const date = parseISO(holiday.date);
                const isSelected = isSameDay(date, selectedDate);
                return (
                  <li key={holiday.date}>
                    <button
                      type="button"
                      onClick={() => handleSelectDate(date)}
                      className={cn(
                        'w-full text-left rounded-md px-2 py-1.5 text-sm transition-colors',
                        isSelected
                          ? 'bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-100'
                          : 'hover:bg-muted'
                      )}
                    >
                      <span className="font-medium">{format(date, 'MMM d')}</span>
                      <span className="text-muted-foreground"> — {holiday.name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </CardContent>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingNote ? 'Edit note' : 'New note'}</DialogTitle>
            <DialogDescription>
              {format(selectedDate, 'EEEE, MMMM d, yyyy')}
            </DialogDescription>
          </DialogHeader>

          <QuillEditor value={editorHtml} onChange={setEditorHtml} />

          {editorError && <p className="text-sm text-destructive">{editorError}</p>}

          <DialogFooter className="gap-2 sm:gap-0">
            {editingNote && (
              <Button
                type="button"
                variant="destructive"
                onClick={() => handleDeleteNote(editingNote)}
                disabled={isSaving}
                className="sm:mr-auto"
              >
                Delete
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => setEditorOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSaveNote} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingNote ? 'Save changes' : 'Add note'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
