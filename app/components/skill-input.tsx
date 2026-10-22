import { X } from "lucide-react";
import { type KeyboardEvent, useEffect, useState } from "react";
import { fieldClass } from "./ui/field";

/**
 * Tokenized skills. Posts the same comma-separated `name` field the server
 * already parses, so it degrades to the hidden value without JavaScript.
 */
export function SkillInput({
  id,
  name,
  skills,
  onChange,
  max = 40,
}: {
  id: string;
  name: string;
  skills: string[];
  onChange: (skills: string[]) => void;
  max?: number;
}) {
  const [draft, setDraft] = useState("");
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  function commit(value: string) {
    const additions = value
      .split(",")
      .map((skill) => skill.trim())
      .filter(Boolean);
    if (!additions.length) return;
    const next = [...skills];
    for (const skill of additions) {
      const exists = next.some(
        (current) => current.toLocaleLowerCase() === skill.toLocaleLowerCase(),
      );
      if (!exists && next.length < max) next.push(skill);
    }
    onChange(next);
    setDraft("");
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      commit(draft);
    } else if (event.key === "Backspace" && !draft && skills.length) {
      onChange(skills.slice(0, -1));
    }
  }

  function move(index: number, offset: number) {
    const target = index + offset;
    if (target < 0 || target >= skills.length) return;
    const next = [...skills];
    [next[index], next[target]] = [
      next[target] as string,
      next[index] as string,
    ];
    onChange(next);
  }

  if (!hydrated) {
    return (
      <textarea
        id={id}
        name={name}
        defaultValue={skills.join(", ")}
        rows={3}
        className={fieldClass}
      />
    );
  }

  return (
    <div>
      <input type="hidden" name={name} value={skills.join(", ")} />
      <div
        className={`${fieldClass} flex min-h-11 flex-wrap items-center gap-1.5 py-1.5 focus-within:border-exhibit`}
      >
        {skills.map((skill, index) => (
          <span
            key={skill}
            className="inline-flex items-center gap-1 rounded-[4px] bg-sheet-sunk py-0.5 pr-0.5 pl-2 text-[0.8125rem]"
          >
            <button
              type="button"
              onKeyDown={(event) => {
                if (event.key === "ArrowLeft") move(index, -1);
                if (event.key === "ArrowRight") move(index, 1);
              }}
              aria-label={`${skill}, position ${index + 1} of ${skills.length}. Arrow keys reorder.`}
              className="cursor-default"
            >
              {skill}
            </button>
            <button
              type="button"
              onClick={() => onChange(skills.filter((item) => item !== skill))}
              aria-label={`Remove ${skill}`}
              className="grid size-5 place-items-center rounded-[3px] text-ink-3 hover:bg-board-deep hover:text-ink"
            >
              <X aria-hidden="true" className="size-3.5" />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => commit(draft)}
          placeholder={
            skills.length ? "Add skill" : "Type a skill, press Enter"
          }
          aria-describedby={`${id}-hint`}
          className="min-w-32 flex-1 bg-transparent py-0.5 text-[0.9375rem] outline-none placeholder:text-ink-3"
        />
      </div>
      <p id={`${id}-hint`} className="mt-1.5 text-[0.8125rem] text-ink-3">
        Enter or comma adds a skill. Only list skills your evidence supports.
      </p>
    </div>
  );
}
