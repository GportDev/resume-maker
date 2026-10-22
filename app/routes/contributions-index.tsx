import { Link } from "react-router";

export default function ContributionsIndex() {
  return (
    <section className="rounded-2xl border border-dashed border-rule-strong p-10">
      <h2 className="text-xl font-semibold">Pick a contribution file</h2>
      <p className="mt-3 max-w-xl text-sm text-ink-2">
        Each position you held has one Markdown file, grouped under its company.
        Record context, contributions, measurable outcomes, and tools. Resume
        tailoring only uses evidence written here.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          to="/contributions/new"
          className="rounded-xl bg-exhibit px-4 py-3 font-semibold text-sheet hover:bg-exhibit-deep"
        >
          New position
        </Link>
        <Link
          to="/contributions/companies/new"
          className="rounded-xl border border-rule-strong px-4 py-3 hover:border-exhibit"
        >
          New company
        </Link>
      </div>
    </section>
  );
}
