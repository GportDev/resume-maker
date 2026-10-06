import { Link } from "react-router";

export default function ContributionsIndex() {
  return (
    <section className="rounded-2xl border border-dashed border-slate-700 p-10">
      <h2 className="text-xl font-semibold">Pick a contribution file</h2>
      <p className="mt-3 max-w-xl text-sm text-slate-400">
        Each position you held has one Markdown file, grouped under its company.
        Record context, contributions, measurable outcomes, and tools. Resume
        tailoring only uses evidence written here.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          to="/contributions/new"
          className="rounded-xl bg-cyan-400 px-4 py-3 font-semibold text-slate-950 hover:bg-cyan-300"
        >
          New position
        </Link>
        <Link
          to="/contributions/companies/new"
          className="rounded-xl border border-slate-700 px-4 py-3 hover:border-cyan-400"
        >
          New company
        </Link>
      </div>
    </section>
  );
}
