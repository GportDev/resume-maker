import {
  type Announcements,
  closestCorners,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  type UniqueIdentifier,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMemo, useRef, useState } from "react";
import { Link, useFetcher } from "react-router";
import {
  type ApplicationCardData,
  type ApplicationStatus,
  applicationStatuses,
  applicationStatusLabels,
  type BoardColumns,
  type PendingMove,
} from "../lib/applications";
import { ApplicationCard } from "./application-card";
import { ConfirmDialog } from "./ui/confirm-dialog";

type ColumnIds = Record<ApplicationStatus, string[]>;
type ActionResult = { error?: string };

const columnPrefix = "column-";

function columnDroppableId(status: ApplicationStatus) {
  return `${columnPrefix}${status}`;
}

function toColumnIds(columns: BoardColumns<ApplicationCardData>): ColumnIds {
  return Object.fromEntries(
    applicationStatuses.map((status) => [
      status,
      columns[status].map((card) => card.id),
    ]),
  ) as ColumnIds;
}

function findColumn(
  ids: ColumnIds,
  id: UniqueIdentifier,
): ApplicationStatus | undefined {
  const key = String(id);
  if (key.startsWith(columnPrefix)) {
    const status = key.slice(columnPrefix.length);
    return applicationStatuses.find((item) => item === status);
  }
  return applicationStatuses.find((status) => ids[status].includes(key));
}

function cardLabel(card: ApplicationCardData | undefined) {
  return card ? `${card.position} at ${card.companyName}` : "Application";
}

export function moveFetcherKey(id: string) {
  return `move-${id}`;
}

export function deleteFetcherKey(id: string) {
  return `delete-${id}`;
}

export function ApplicationBoard({
  columns,
  onMove,
}: {
  columns: BoardColumns<ApplicationCardData>;
  onMove: (move: PendingMove) => void;
}) {
  const [dragIds, setDragIds] = useState<ColumnIds | null>(null);
  const originRef = useRef<ApplicationStatus | null>(null);
  const ids = dragIds ?? toColumnIds(columns);
  const idsRef = useRef(ids);
  idsRef.current = ids;

  const cardsById = useMemo(
    () =>
      new Map(
        applicationStatuses
          .flatMap((status) => columns[status])
          .map((card) => [card.id, card]),
      ),
    [columns],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function describePosition(activeId: UniqueIdentifier, targetId = activeId) {
    const current = idsRef.current;
    const status = findColumn(current, targetId);
    if (!status) return "";
    const column = current[status];
    const includesActive = column.includes(String(activeId));
    const total = includesActive ? column.length : column.length + 1;
    const index = column.indexOf(String(targetId));
    const position = index === -1 ? total : index + 1;
    return `${applicationStatusLabels[status]} column, position ${position} of ${total}`;
  }

  const announcements: Announcements = {
    onDragStart({ active }) {
      return `Picked up ${cardLabel(cardsById.get(String(active.id)))}. ${describePosition(active.id)}.`;
    },
    onDragOver({ active, over }) {
      const label = cardLabel(cardsById.get(String(active.id)));
      if (!over) return `${label} is not over a column.`;
      return `${label} moved to ${describePosition(active.id, over.id)}.`;
    },
    onDragEnd({ active, over }) {
      const label = cardLabel(cardsById.get(String(active.id)));
      if (!over) return `${label} dropped outside the board. No change.`;
      return `${label} dropped in ${describePosition(active.id, over.id)}.`;
    },
    onDragCancel({ active }) {
      const origin = originRef.current;
      return `Move cancelled. ${cardLabel(cardsById.get(String(active.id)))} returned to ${
        origin ? applicationStatusLabels[origin] : "its column"
      }.`;
    },
  };

  function handleDragStart({ active }: DragStartEvent) {
    const current = toColumnIds(columns);
    originRef.current = findColumn(current, active.id) ?? null;
    setDragIds(current);
  }

  function handleDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    setDragIds((previous) => {
      if (!previous) return previous;
      const from = findColumn(previous, active.id);
      const to = findColumn(previous, over.id);
      if (!from || !to || from === to) return previous;
      const activeId = String(active.id);
      const target = previous[to];
      const overIndex = target.indexOf(String(over.id));
      const insertAt = overIndex === -1 ? target.length : overIndex;
      return {
        ...previous,
        [from]: previous[from].filter((id) => id !== activeId),
        [to]: [
          ...target.slice(0, insertAt),
          activeId,
          ...target.slice(insertAt),
        ],
      };
    });
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    const current = idsRef.current;
    const origin = originRef.current;
    setDragIds(null);
    originRef.current = null;
    if (!over || !origin) return;

    const activeId = String(active.id);
    const status = findColumn(current, active.id);
    if (!status) return;
    let finalIds = current[status];
    const overIndex = finalIds.indexOf(String(over.id));
    const activeIndex = finalIds.indexOf(activeId);
    if (overIndex !== -1 && overIndex !== activeIndex) {
      finalIds = arrayMove(finalIds, activeIndex, overIndex);
    }

    const index = finalIds.indexOf(activeId);
    const originalIds = columns[origin].map((card) => card.id);
    if (status === origin && originalIds.indexOf(activeId) === index) return;

    onMove({
      id: activeId,
      status,
      beforeId: finalIds[index - 1],
      afterId: finalIds[index + 1],
    });
  }

  function handleDragCancel() {
    setDragIds(null);
  }

  return (
    <DndContext
      id="application-board"
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable:
            "To move this application, press Space or Enter. Use the arrow keys to move between positions and columns, Space or Enter to drop, and Escape to cancel.",
        },
      }}
    >
      <div className="grid snap-x auto-cols-[minmax(16rem,1fr)] grid-flow-col gap-4 overflow-x-auto pb-4">
        {applicationStatuses.map((status) => (
          <BoardColumn
            key={status}
            status={status}
            cards={ids[status].flatMap((id) => {
              const card = cardsById.get(id);
              return card ? [{ ...card, status }] : [];
            })}
          />
        ))}
      </div>
    </DndContext>
  );
}

function BoardColumn({
  status,
  cards,
}: {
  status: ApplicationStatus;
  cards: ApplicationCardData[];
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: columnDroppableId(status),
  });
  const label = applicationStatusLabels[status];
  const headingId = `column-${status}-heading`;

  return (
    <section
      aria-labelledby={headingId}
      className="flex min-h-[24rem] snap-start flex-col rounded-2xl border border-rule bg-sheet-sunk p-3"
    >
      <header className="flex items-center justify-between gap-2 px-1">
        <h2 id={headingId} className="text-sm font-semibold">
          {label}{" "}
          <span className="font-normal text-ink-3">({cards.length})</span>
        </h2>
        <Link
          to={`/applications/new?status=${status}`}
          aria-label={`Add application to ${label}`}
          className="rounded-md px-2 py-1 text-xs text-exhibit hover:bg-sheet-sunk hover:text-exhibit-deep"
        >
          + Add
        </Link>
      </header>
      <SortableContext items={cards} strategy={verticalListSortingStrategy}>
        <ol
          ref={setNodeRef}
          className={`mt-3 flex flex-1 flex-col gap-2 rounded-xl p-0.5 ${
            isOver ? "bg-exhibit-tint" : ""
          }`}
        >
          {cards.map((card) => (
            <SortableApplication key={card.id} application={card} />
          ))}
          {cards.length === 0 ? (
            <li className="rounded-xl border border-dashed border-rule p-4 text-center text-xs text-ink-3">
              No applications in {label.toLowerCase()}.
            </li>
          ) : null}
        </ol>
      </SortableContext>
    </section>
  );
}

function SortableApplication({
  application,
}: {
  application: ApplicationCardData;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: application.id });
  const label = cardLabel(application);

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={isDragging ? "relative z-10 opacity-60" : undefined}
    >
      <ApplicationCard
        application={application}
        dragHandle={
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-label={`Drag ${label}`}
            className="cursor-grab touch-none rounded-md px-1.5 py-1 text-ink-3 hover:bg-sheet-sunk hover:text-ink active:cursor-grabbing"
          >
            <span aria-hidden="true">⠿</span>
          </button>
        }
        actions={<CardActions application={application} />}
      />
    </li>
  );
}

function CardActions({ application }: { application: ApplicationCardData }) {
  const moveFetcher = useFetcher<ActionResult>({
    key: moveFetcherKey(application.id),
  });
  const label = cardLabel(application);
  const selectId = `status-${application.id}`;
  const error = moveFetcher.data?.error;

  return (
    <div className="space-y-2">
      <moveFetcher.Form method="post" className="flex items-center gap-1.5">
        <input type="hidden" name="intent" value="move" />
        <input type="hidden" name="id" value={application.id} />
        <label htmlFor={selectId} className="sr-only">
          Status for {label}
        </label>
        <select
          id={selectId}
          name="status"
          key={application.status}
          defaultValue={application.status}
          className="min-w-0 flex-1 rounded-md border border-rule-strong bg-field px-2 py-1 text-xs"
        >
          {applicationStatuses.map((status) => (
            <option key={status} value={status}>
              {applicationStatusLabels[status]}
            </option>
          ))}
        </select>
        <button
          type="submit"
          aria-label={`Move ${label}`}
          className="rounded-md border border-rule-strong px-2 py-1 text-xs hover:border-exhibit"
        >
          Move
        </button>
      </moveFetcher.Form>
      <ConfirmDialog
        triggerLabel="Delete"
        triggerVariant="ghost"
        triggerClassName="text-ink-3 hover:text-danger"
        title={`Delete ${label}?`}
        description="The application, its notes, and links to its tailored documents are removed permanently."
        confirmLabel="Delete application"
        fields={{ intent: "delete", id: application.id }}
        fetcherKey={deleteFetcherKey(application.id)}
      />
      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
