import {
  type Announcements,
  closestCorners,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
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
import {
  ArrowRight,
  ChevronsLeftRight,
  ExternalLink,
  GripVertical,
  MoreHorizontal,
  Sparkles,
  Trash2,
} from "lucide-react";
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
import { ApplicationCard, StatusBadge } from "./application-card";
import { buttonClass } from "./ui/button";
import { ConfirmDialog, openDialog } from "./ui/confirm-dialog";
import { Popover, popoverItemClass } from "./ui/popover";

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
  const [activeId, setActiveId] = useState<string | null>(null);
  const [keyboardDrag, setKeyboardDrag] = useState(false);
  const [closedOpen, setClosedOpen] = useState(false);
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

  function handleDragStart({ active, activatorEvent }: DragStartEvent) {
    setActiveId(String(active.id));
    setKeyboardDrag(activatorEvent instanceof KeyboardEvent);
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
    setActiveId(null);
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
    setActiveId(null);
  }

  const activeCard = activeId ? cardsById.get(activeId) : undefined;
  const openStatuses = applicationStatuses.filter(
    (status) => status !== "rejected" && status !== "withdrawn",
  );
  const closedStatuses = ["rejected", "withdrawn"] as const;
  const closedCount = closedStatuses.reduce(
    (total, status) => total + ids[status].length,
    0,
  );

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
      <div className="relative flex snap-x gap-3 overflow-x-auto pb-4">
        {openStatuses.map((status) => (
          <BoardColumn
            key={status}
            status={status}
            cards={ids[status].flatMap((id) => {
              const card = cardsById.get(id);
              return card ? [{ ...card, status }] : [];
            })}
          />
        ))}
        {closedOpen ? (
          closedStatuses.map((status) => (
            <BoardColumn
              key={status}
              status={status}
              onCollapse={
                status === "rejected" ? () => setClosedOpen(false) : undefined
              }
              cards={ids[status].flatMap((id) => {
                const card = cardsById.get(id);
                return card ? [{ ...card, status }] : [];
              })}
            />
          ))
        ) : (
          <ClosedLane
            count={closedCount}
            onExpand={() => setClosedOpen(true)}
          />
        )}
      </div>
      <DragOverlay
        dropAnimation={
          keyboardDrag
            ? null
            : { duration: 200, easing: "cubic-bezier(0.23, 1, 0.32, 1)" }
        }
      >
        {activeCard ? (
          <div
            className={
              keyboardDrag
                ? "rounded-sheet shadow-lifted"
                : "lift rounded-sheet shadow-lifted"
            }
          >
            <ApplicationCard
              application={activeCard}
              showStatus={false}
              dragHandle={<DragGrip />}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function ClosedLane({
  count,
  onExpand,
}: {
  count: number;
  onExpand: () => void;
}) {
  const rejected = useDroppable({ id: columnDroppableId("rejected") });
  const isOver = rejected.isOver;
  return (
    <section
      ref={rejected.setNodeRef}
      aria-label="Closed applications"
      className={`flex w-14 shrink-0 snap-start flex-col items-center rounded-sheet border py-3 ${
        isOver
          ? "border-exhibit bg-exhibit-tint"
          : "border-rule-strong/40 bg-board-deep/50"
      }`}
    >
      <button
        type="button"
        onClick={onExpand}
        aria-label={`Show closed applications (${count})`}
        className="pressable flex flex-col items-center gap-3 rounded-control px-2 py-1 text-ink-2 hover:text-ink"
      >
        <ChevronsLeftRight aria-hidden="true" className="size-4" />
        <span className="text-sm font-semibold [writing-mode:vertical-rl]">
          Closed <span className="tabular font-normal text-ink-3">{count}</span>
        </span>
      </button>
    </section>
  );
}

function BoardColumn({
  status,
  cards,
  onCollapse,
}: {
  status: ApplicationStatus;
  cards: ApplicationCardData[];
  onCollapse?: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: columnDroppableId(status),
  });
  const label = applicationStatusLabels[status];
  const headingId = `column-${status}-heading`;

  return (
    <section
      aria-labelledby={headingId}
      className={`flex min-h-[28rem] w-[17.5rem] shrink-0 snap-start flex-col rounded-sheet border p-2 transition-[background-color,border-color] duration-150 ${
        isOver
          ? "border-exhibit bg-exhibit-tint/70"
          : "border-rule-strong/40 bg-board-deep/50"
      }`}
    >
      <header className="flex items-center gap-2 px-1.5 pt-0.5 pb-2">
        <h2 id={headingId} className="flex-1">
          <StatusBadge status={status} />{" "}
          <span className="tabular ml-1 text-sm font-normal text-ink-3">
            {cards.length}
          </span>
        </h2>
        {onCollapse ? (
          <button
            type="button"
            onClick={onCollapse}
            aria-label="Hide closed applications"
            className={buttonClass({ variant: "ghost", size: "sm" })}
          >
            <ChevronsLeftRight aria-hidden="true" className="size-4" />
          </button>
        ) : null}
        <Link
          to={`/applications/new?status=${status}`}
          aria-label={`Add application to ${label}`}
          title={`Add to ${label}`}
          className={buttonClass({ variant: "ghost", size: "sm" })}
        >
          +
        </Link>
      </header>
      <SortableContext items={cards} strategy={verticalListSortingStrategy}>
        <ol ref={setNodeRef} className="flex flex-1 flex-col gap-2">
          {cards.map((card) => (
            <SortableApplication key={card.id} application={card} />
          ))}
          {cards.length === 0 ? (
            <li className="rounded-sheet border border-dashed border-rule-strong/60 p-4 text-center text-[0.8125rem] text-ink-3">
              Drop a card here
            </li>
          ) : null}
        </ol>
      </SortableContext>
    </section>
  );
}

function DragGrip() {
  return (
    <span className="grid size-7 place-items-center rounded-[4px] text-ink-3">
      <GripVertical aria-hidden="true" className="size-4" />
    </span>
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
      className={
        isDragging
          ? "rounded-sheet border border-dashed border-exhibit/60 bg-exhibit-tint/40 [&>*]:invisible"
          : undefined
      }
    >
      <ApplicationCard
        application={application}
        showStatus={false}
        dragHandle={
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-label={`Drag ${label}`}
            className="grid size-7 cursor-grab touch-none place-items-center rounded-[4px] text-ink-3 hover:bg-sheet-sunk hover:text-ink active:cursor-grabbing"
          >
            <GripVertical aria-hidden="true" className="size-4" />
          </button>
        }
        menu={<CardMenu application={application} />}
        actions={<CardFallback application={application} />}
      />
    </li>
  );
}

function CardMenu({ application }: { application: ApplicationCardData }) {
  const moveFetcher = useFetcher<ActionResult>({
    key: moveFetcherKey(application.id),
  });
  const label = cardLabel(application);
  const menuId = `card-menu-${application.id}`;
  const deleteDialogId = `delete-${application.id}`;
  function moveTo(status: ApplicationStatus) {
    document.getElementById(menuId)?.hidePopover();
    moveFetcher.submit(
      { intent: "move", id: application.id, status },
      { method: "post" },
    );
  }

  return (
    <>
      <Popover
        id={menuId}
        align="end"
        triggerLabel={`Actions for ${label}`}
        triggerClassName="grid size-7 place-items-center rounded-[4px] text-ink-3 hover:bg-sheet-sunk hover:text-ink"
        trigger={<MoreHorizontal aria-hidden="true" className="size-4" />}
      >
        <Link
          to={`/applications/${application.id}`}
          className={popoverItemClass}
        >
          <ExternalLink aria-hidden="true" className="size-4 text-ink-3" />
          Open
        </Link>
        <Link
          to={`/applications/${application.id}/tailor`}
          className={popoverItemClass}
        >
          <Sparkles aria-hidden="true" className="size-4 text-ink-3" />
          Tailor
        </Link>
        <p className="mt-1.5 border-t border-rule px-2.5 pt-2 pb-1 text-[0.75rem] font-medium text-ink-3">
          Move to
        </p>
        {applicationStatuses
          .filter((status) => status !== application.status)
          .map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => moveTo(status)}
              className={popoverItemClass}
            >
              <ArrowRight aria-hidden="true" className="size-4 text-ink-3" />
              {applicationStatusLabels[status]}
            </button>
          ))}
        <button
          type="button"
          onClick={() => openDialog(deleteDialogId)}
          className={`${popoverItemClass} mt-1.5 border-t border-rule text-danger`}
        >
          <Trash2 aria-hidden="true" className="size-4" />
          Delete
        </button>
      </Popover>
      <ConfirmDialog
        dialogId={deleteDialogId}
        hideTrigger
        triggerLabel="Delete"
        title={`Delete ${label}?`}
        description="The application, its notes, and links to its tailored documents are removed permanently."
        confirmLabel="Delete application"
        fields={{ intent: "delete", id: application.id }}
        fetcherKey={deleteFetcherKey(application.id)}
      />
    </>
  );
}

function CardFallback({ application }: { application: ApplicationCardData }) {
  const moveFetcher = useFetcher<ActionResult>({
    key: moveFetcherKey(application.id),
  });
  const label = cardLabel(application);
  const selectId = `status-${application.id}`;
  const error = moveFetcher.data?.error;
  return (
    <>
      <noscript>
        <form method="post" className="mt-2 flex items-center gap-1.5">
          <input type="hidden" name="intent" value="move" />
          <input type="hidden" name="id" value={application.id} />
          <label htmlFor={selectId} className="sr-only">
            Status for {label}
          </label>
          <select
            id={selectId}
            name="status"
            defaultValue={application.status}
            className="min-w-0 flex-1 rounded-[4px] border border-rule-strong bg-field px-2 py-1 text-xs"
          >
            {applicationStatuses.map((status) => (
              <option key={status} value={status}>
                {applicationStatusLabels[status]}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-[4px] border border-rule-strong px-2 py-1 text-xs"
          >
            Move
          </button>
        </form>
      </noscript>
      {error ? (
        <p role="alert" className="mt-1 text-xs text-danger">
          {error}
        </p>
      ) : null}
    </>
  );
}
