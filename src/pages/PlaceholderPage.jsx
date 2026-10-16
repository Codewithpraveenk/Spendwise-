import { Link } from 'react-router';

export default function PlaceholderPage({ title, description }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-8 sm:p-12">
      <p className="text-sm font-semibold text-indigo-600">COMING IN A LATER STEP</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">{title}</h1>
      <p className="mt-4 max-w-lg leading-7 text-slate-500">{description}</p>
      <Link to="/" className="mt-6 inline-block rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700">Back to overview</Link>
    </section>
  );
}
