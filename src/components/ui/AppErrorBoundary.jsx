import { Component } from 'react';

export default class AppErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="mx-auto max-w-lg px-5 py-20">
        <h1 className="text-2xl font-semibold">SpendWise couldn’t display this page</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">Reload to try again. Changes that were not saved may be lost.</p>
        <button type="button" onClick={() => window.location.reload()} className="mt-6 rounded-lg bg-indigo-600 px-4 py-3 text-sm font-medium text-white hover:bg-indigo-700">Reload SpendWise</button>
      </main>
    );
  }
}
